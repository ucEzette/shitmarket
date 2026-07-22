/**
 * evm-backfill.js - Pure JS backfill (no TypeScript compilation)
 * Run: node scripts/evm-backfill.js
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const https = require('https');

const prisma = new PrismaClient();
const RPC_URL = process.env.AVALANCHE_RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc';
const CONTRACT = (process.env.CORE_CONTRACT_ADDRESS || '0x803E97FDffE050bfd781c26ba8a65DF069ae9cC6').toLowerCase();
const LOOKBACK = parseInt(process.env.BACKFILL_LOOKBACK_BLOCKS || '60000', 10);
const CHUNK = 500;

const TOPICS = {
  RoomCreated: '0xf97c4c3d156ed53cd560336ada7fa3650fbf8776167b109f16d44f2272878015',
  BetPlaced:   '0xcded998c66303d5ffd5e3e307d828cf41226e0a77e5f9dbff723ddb5f54b9b0b',
  RoomSettled: '0xf69da01a307d1f7792a3153a45a6f1f50277280d9eb0564e0d897c781fa2478b',
};

function rpcPost(body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const url = new URL(RPC_URL);
    const opts = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    };
    const req = https.request(opts, (res) => {
      let buf = '';
      res.on('data', d => buf += d);
      res.on('end', () => {
        try { resolve(JSON.parse(buf)); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(new Error('timeout')); });
    req.write(data);
    req.end();
  });
}

function decodeStr(hex, slotIdx) {
  // hex starts with '0x'
  const d = hex.slice(2);
  const offsetBytes = parseInt(d.slice(slotIdx * 64, (slotIdx + 1) * 64), 16);
  const pos = offsetBytes * 2; // position in d (each byte = 2 hex chars)
  const len = parseInt(d.slice(pos, pos + 64), 16);
  const textHex = d.slice(pos + 64, pos + 64 + len * 2);
  return Buffer.from(textHex, 'hex').toString('utf8').replace(/\0/g, '').trim();
}

function decodeAddr(topic) {
  return '0x' + topic.slice(26).toLowerCase();
}

function decodeInt64(hexSlice) {
  const big = BigInt('0x' + hexSlice);
  const sign = BigInt(1) << BigInt(63);
  return big & sign ? Number(big - (BigInt(1) << BigInt(64))) : Number(big);
}

async function handleRoomCreated(log) {
  const roomId = log.topics[1];  // bytes32 hex, 66 chars
  const creator = decodeAddr(log.topics[2]);  // 42 chars
  const d = log.data.slice(2);   // strip 0x

  // ABI slots in data (each 64 hex chars = 32 bytes):
  // [0] tokenMint address (padded)
  // [1] offset → tokenName/description string
  // [2] offset → chainId string  
  // [3] openingPrice int64
  // [4] expiryTimestamp uint256
  // [5] oracle address
  // [6] oracleFeeAmount uint256
  const tokenMint = ('0x' + d.slice(24, 64)).toLowerCase(); // 42 chars
  const openingPrice = decodeInt64(d.slice(3 * 64, 4 * 64));
  const expiryTimestamp = BigInt('0x' + d.slice(4 * 64, 5 * 64));
  const oracle = decodeAddr('0x' + d.slice(5 * 64, 6 * 64).slice(24));
  const oracleFeeAmount = BigInt('0x' + d.slice(6 * 64, 7 * 64));

  let rawName = '', rawChain = 'avalanche';
  try { rawName = decodeStr(log.data, 1); } catch {}
  try { rawChain = decodeStr(log.data, 2) || 'avalanche'; } catch {}
  rawName = rawName.replace(/\0/g, '').trim();
  rawChain = rawChain.replace(/\0/g, '').trim() || 'avalanche';

  const resolutionCriteria = rawName.slice(0, 500);
  const tokenName = (rawName.length > 40 ? rawName.slice(0, 37) + '...' : rawName || 'Debate Market').slice(0, 66);
  const tokenSymbol = 'DEBATE';
  const chainId = rawChain.slice(0, 20);
  const expiry = new Date(Number(expiryTimestamp) * 1000);

  await prisma.room.upsert({
    where: { roomPubkey: roomId },
    create: {
      roomPubkey: roomId,
      tokenMint: tokenMint.slice(0, 66),
      priceFeed: 'evm-aggregated',
      tokenName,
      tokenSymbol,
      chainId,
      originalAddress: tokenMint.slice(0, 66),
      duration: 60,
      openingPrice: BigInt(openingPrice),
      expiry,
      status: 'active',
      creator: creator.slice(0, 66),
      oracleAddress: oracle.slice(0, 66),
      oracleFeeLamports: oracleFeeAmount,
      resolutionCriteria,
    },
    update: {
      openingPrice: BigInt(openingPrice),
      expiry,
      oracleAddress: oracle.slice(0, 66),
      resolutionCriteria,
    },
  });

  console.log(`  [RoomCreated] ${roomId.slice(0, 22)}... name="${tokenName}" expiry=${expiry.toISOString().slice(0,10)}`);
  if (resolutionCriteria) console.log(`    desc: "${resolutionCriteria.slice(0, 80)}"`);
  return true;
}

async function handleBetPlaced(log, knownRooms) {
  const roomId = log.topics[1];
  const user = decodeAddr(log.topics[2]);
  const d = log.data.slice(2);

  const side = parseInt(d.slice(0, 64), 16) === 0 ? 'moon' : 'jeet';
  const amount = BigInt('0x' + d.slice(64, 128));
  const moonPool = BigInt('0x' + d.slice(128, 192));
  const jeetPool = BigInt('0x' + d.slice(192, 256));

  // Only write bet if room exists
  if (!knownRooms.has(roomId)) {
    const exists = await prisma.room.findUnique({ where: { roomPubkey: roomId }, select: { roomPubkey: true } });
    if (!exists) {
      console.log(`  [BetPlaced] skipped — room ${roomId.slice(0,22)}... not in DB`);
      return false;
    }
    knownRooms.add(roomId);
  }

  const existing = await prisma.bet.findFirst({ where: { roomPubkey: roomId, userPubkey: user, side } });
  if (existing) {
    await prisma.bet.update({ where: { id: existing.id }, data: { amount: existing.amount + amount, txSig: log.transactionHash.slice(0, 88) } });
  } else {
    await prisma.bet.create({ data: { roomPubkey: roomId, userPubkey: user.slice(0, 66), side, amount, txSig: log.transactionHash.slice(0, 88) } });
  }
  await prisma.room.update({ where: { roomPubkey: roomId }, data: { totalPool: { increment: amount } } }).catch(() => {});
  console.log(`  [BetPlaced] room=${roomId.slice(0,20)}... user=${user.slice(0,16)}... side=${side} amt=${amount}`);
  return true;
}

async function handleRoomSettled(log) {
  const roomId = log.topics[1];
  const d = log.data.slice(2);
  const winnerInt = parseInt(d.slice(0, 64), 16);
  const winner = winnerInt === 2 ? 'draw' : winnerInt === 0 ? 'moon' : 'jeet';
  await prisma.room.update({
    where: { roomPubkey: roomId },
    data: { status: 'settled', winner, settledAt: new Date() },
  }).catch(() => {});
  console.log(`  [RoomSettled] room=${roomId.slice(0,20)}... winner=${winner}`);
}

async function main() {
  console.log('=== EVM Backfill (JS) ===');
  console.log('RPC:', RPC_URL);
  console.log('Contract:', CONTRACT);

  const latestRes = await rpcPost({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] });
  const latest = parseInt(latestRes.result, 16);
  const start = Math.max(0, latest - LOOKBACK);
  console.log(`Scanning blocks ${start} → ${latest} (${latest - start} blocks in ~${Math.ceil((latest - start) / CHUNK)} chunks)`);

  let rooms = 0, bets = 0, errors = 0;
  const knownRooms = new Set();

  // Pre-load existing room IDs from DB
  const existingRooms = await prisma.room.findMany({ select: { roomPubkey: true } });
  existingRooms.forEach(r => knownRooms.add(r.roomPubkey));
  console.log(`Pre-loaded ${knownRooms.size} existing rooms from DB\n`);

  for (let from = start; from <= latest; from += CHUNK) {
    const to = Math.min(from + CHUNK - 1, latest);
    const body = {
      jsonrpc: '2.0', id: 2, method: 'eth_getLogs',
      params: [{ address: CONTRACT, fromBlock: '0x' + from.toString(16), toBlock: '0x' + to.toString(16) }],
    };

    let logs = [];
    try {
      const res = await rpcPost(body);
      if (res.error) {
        process.stdout.write(`  [WARN] chunk ${from}-${to}: ${res.error.message.slice(0, 60)}\n`);
      } else {
        logs = res.result || [];
      }
    } catch (err) {
      process.stdout.write(`  [ERR] chunk ${from}-${to}: ${err.message.slice(0, 60)}\n`);
      errors++;
      await new Promise(r => setTimeout(r, 500));
      continue;
    }

    for (const log of logs) {
      const t0 = (log.topics[0] || '').toLowerCase();
      try {
        if (t0 === TOPICS.RoomCreated) { await handleRoomCreated(log); knownRooms.add(log.topics[1]); rooms++; }
        else if (t0 === TOPICS.BetPlaced) { const ok = await handleBetPlaced(log, knownRooms); if (ok) bets++; }
        else if (t0 === TOPICS.RoomSettled) { await handleRoomSettled(log); }
      } catch (err) {
        console.error(`  [ERROR] tx=${log.transactionHash.slice(0, 30)}...: ${err.message.slice(0, 100)}`);
        errors++;
      }
    }

    const pct = Math.round(((from - start) / (latest - start)) * 100);
    if ((from - start) % (CHUNK * 20) === 0) {
      process.stdout.write(`Progress ${pct}% block ${from}/${latest} | rooms=${rooms} bets=${bets} err=${errors}\n`);
    }

    await new Promise(r => setTimeout(r, 30));
  }

  console.log('\n=== Backfill Complete ===');
  console.log(`Rooms indexed: ${rooms}`);
  console.log(`Bets indexed: ${bets}`);
  console.log(`Errors: ${errors}`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
