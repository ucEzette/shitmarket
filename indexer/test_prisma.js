const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const https = require('https');

const RPC_URL = 'https://api.avax-test.network/ext/bc/C/rpc';
const TX = '0xf84125d88c09cd00ed2b6b23b530721c336274810ced5940f7e9ad730998b9d9';

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
      res.on('end', () => resolve(JSON.parse(buf)));
    });
    req.on('error', reject);
    req.write(data); req.end();
  });
}

function decodeStr(hex, slotIdx) {
  const d = hex.slice(2);
  const offsetBytes = parseInt(d.slice(slotIdx * 64, (slotIdx + 1) * 64), 16);
  const pos = offsetBytes * 2;
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

async function main() {
  const receipt = await rpcPost({ jsonrpc: '2.0', id: 1, method: 'eth_getTransactionReceipt', params: [TX] });
  const log = receipt.result.logs[0];
  const roomId = log.topics[1];
  const creator = decodeAddr(log.topics[2]);
  const d = log.data.slice(2);

  const tokenMint = ('0x' + d.slice(24, 64)).toLowerCase();
  const openingPrice = decodeInt64(d.slice(3 * 64, 4 * 64));
  const expiryTimestamp = BigInt('0x' + d.slice(4 * 64, 5 * 64));
  const oracle = decodeAddr('0x' + d.slice(5 * 64, 6 * 64).slice(24));
  const oracleFeeAmount = BigInt('0x' + d.slice(6 * 64, 7 * 64));

  let rawName = '', rawChain = 'avalanche';
  try { rawName = decodeStr(log.data, 1); } catch {}
  try { rawChain = decodeStr(log.data, 2) || 'avalanche'; } catch {}
  rawName = rawName.replace(/\0/g, '').trim();
  rawChain = rawChain.replace(/\0/g, '').trim() || 'avalanche';

  const resolutionCriteria = rawName; // try full
  const tokenName = (rawName.length > 40 ? rawName.slice(0, 37) + '...' : rawName || 'Debate Market').slice(0, 66);
  const tokenSymbol = 'DEBATE';
  const chainId = rawChain.slice(0, 20);
  const expiry = new Date(Number(expiryTimestamp) * 1000);

  const roomData = {
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
    resolutionCriteria, // Let's see if this fails
  };

  console.log('Inserting Room Data:', JSON.stringify(roomData, (k,v) => typeof v === 'bigint' ? v.toString() : v, 2));

  try {
    const res = await prisma.room.upsert({
      where: { roomPubkey: roomId },
      create: roomData,
      update: {
        openingPrice: BigInt(openingPrice),
        expiry,
        oracleAddress: oracle.slice(0, 66),
        resolutionCriteria,
      }
    });
    console.log('Room upsert succeeded:', res.id);
  } catch (err) {
    console.error('Room upsert failed with full error details:');
    console.error(err);
  }

  // Let's also try to insert a dummy Bet for this room to see why it fails
  const betData = {
    roomPubkey: roomId,
    userPubkey: creator.slice(0, 66),
    side: 'moon',
    amount: BigInt(1000000),
    txSig: TX,
  };
  console.log('Inserting Bet Data:', JSON.stringify(betData, (k,v) => typeof v === 'bigint' ? v.toString() : v, 2));
  try {
    const res = await prisma.bet.create({
      data: betData
    });
    console.log('Bet create succeeded:', res.id);
  } catch (err) {
    console.error('Bet create failed with full error details:');
    console.error(err);
  }

  await prisma.$disconnect();
}

main();
