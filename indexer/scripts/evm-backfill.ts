/**
 * evm-backfill.ts
 * 
 * One-time backfill of all historical EVM contract events into the database.
 * Run with: npx ts-node scripts/evm-backfill.ts
 * 
 * Scans from a configurable start block up to the current block in chunks
 * of 500, persisting all RoomCreated, BetPlaced, and RoomSettled events.
 */

import 'dotenv/config';
import axios from 'axios';
import { prisma } from '../src/db';
import { redis } from '../src/redis';
import { cacheRoom } from '../src/redis';
import { logger } from '../src/logger';

const RPC_URL = process.env.AVALANCHE_RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc';
const CONTRACT = process.env.CORE_CONTRACT_ADDRESS || '0x803E97FDffE050bfd781c26ba8a65DF069ae9cC6';

// How many blocks to look back from current tip if no start specified
// Default: ~7 days on Fuji (2 blocks/sec * 60 * 60 * 24 * 7 ≈ 1.2M blocks)
const LOOKBACK_BLOCKS = parseInt(process.env.BACKFILL_LOOKBACK_BLOCKS || '1500000', 10);
const CHUNK_SIZE = 500; // Fuji RPC max

const TOPICS = {
  RoomCreated: '0xf97c4c3d156ed53cd560336ada7fa3650fbf8776167b109f16d44f2272878015',
  BetPlaced: '0xcded998c66303d5ffd5e3e307d828cf41226e0a77e5f9dbff723ddb5f54b9b0b',
  RoomSettled: '0xf69da01a307d1f7792a3153a45a6f1f50277280d9eb0564e0d897c781fa2478b',
};

interface EvmLog {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
  transactionHash: string;
}

function decodeString(dataHex: string, offset: number): string {
  const dataOffset = parseInt(dataHex.slice(2 + offset * 64, 2 + (offset + 1) * 64), 16) * 2;
  const length = parseInt(dataHex.slice(2 + dataOffset, 2 + dataOffset + 64), 16);
  const textHex = dataHex.slice(2 + dataOffset + 64, 2 + dataOffset + 64 + length * 2);
  return Buffer.from(textHex, 'hex').toString('utf8').replace(/\0/g, '').trim();
}

function decodeAddress(hex: string): string {
  return '0x' + hex.slice(26).toLowerCase();
}

function decodeBigInt(hex: string): bigint {
  return BigInt('0x' + hex);
}

function decodeInt64(hex: string): number {
  const big = BigInt('0x' + hex);
  if (big & (BigInt(1) << BigInt(63))) {
    return Number(big - (BigInt(1) << BigInt(64)));
  }
  return Number(big);
}

async function rpcCall(method: string, params: any[]): Promise<any> {
  const { data } = await axios.post(RPC_URL, {
    jsonrpc: '2.0', id: 1, method, params
  }, { timeout: 10000 });
  return data?.result;
}

async function handleRoomCreated(log: EvmLog): Promise<void> {
  const roomId = log.topics[1];
  const creator = decodeAddress(log.topics[2]);
  const data = log.data.replace('0x', '');

  // ABI layout (non-indexed params in data):
  // slot[0] = tokenMint (address, left-padded)
  // slot[1] = offset to tokenName string
  // slot[2] = offset to chainId/resolutionCriteria string
  // slot[3] = openingPrice (int64)
  // slot[4] = expiryTimestamp (uint256)
  // slot[5] = oracle (address)
  // slot[6] = oracleFeeAmount (uint256)
  const tokenMintRaw = data.slice(0, 64);
  const tokenMint = '0x' + tokenMintRaw.slice(24).toLowerCase();
  const openingPrice = decodeInt64(data.slice(3 * 64, 4 * 64));
  const expiryTimestamp = decodeBigInt(data.slice(4 * 64, 5 * 64));
  const oracle = decodeAddress(data.slice(5 * 64, 6 * 64));
  const oracleFeeAmount = decodeBigInt(data.slice(6 * 64, 7 * 64));

  // Decode dynamic strings at offsets 1 and 2
  let rawTokenName = '';
  let rawChainId = 'avalanche';
  try { rawTokenName = decodeString(log.data, 1); } catch {}
  try { rawChainId = decodeString(log.data, 2) || 'avalanche'; } catch {}

  // Sanitize: strip null bytes and trim
  rawTokenName = rawTokenName.replace(/\0/g, '').trim();
  rawChainId = rawChainId.replace(/\0/g, '').trim() || 'avalanche';

  // The tokenName may be a long question/description — keep it in resolutionCriteria
  // and use a short truncated name for display columns (VarChar(66) limit)
  const resolutionCriteria = rawTokenName.slice(0, 500); // store full text
  const tokenName = rawTokenName.length > 40 
    ? rawTokenName.slice(0, 37).trim() + '...'
    : rawTokenName || 'Debate Market';
  const tokenSymbol = 'DEBATE';
  const chainId = rawChainId.slice(0, 20); // VarChar safe

  const expiry = new Date(Number(expiryTimestamp) * 1000);

  await prisma.room.upsert({
    where: { roomPubkey: roomId },
    create: {
      roomPubkey: roomId,
      tokenMint: tokenMint.slice(0, 66),
      priceFeed: 'evm-aggregated',
      tokenName: tokenName.slice(0, 66),
      tokenSymbol: tokenSymbol.slice(0, 20),
      chainId: chainId.slice(0, 20),
      originalAddress: tokenMint.slice(0, 66),
      duration: 60,
      openingPrice: BigInt(openingPrice),
      expiry,
      status: 'active',
      creator: creator.slice(0, 66),
      oracleAddress: oracle.slice(0, 66),
      oracleFeeLamports: oracleFeeAmount,
      resolutionCriteria: resolutionCriteria,
    },
    update: {
      openingPrice: BigInt(openingPrice),
      expiry,
      oracleAddress: oracle.slice(0, 66),
      resolutionCriteria: resolutionCriteria,
    }
  });

  await cacheRoom(roomId, {
    status: 'active',
    tokenMint: tokenMint.slice(0, 66),
    tokenName,
    tokenSymbol,
    openingPrice: openingPrice.toString(),
    moonPool: '0',
    jeetPool: '0',
    expiry: expiry.toISOString(),
  });

  console.log(`  [RoomCreated] ${roomId.slice(0, 20)}... name=${tokenName} chain=${chainId} expiry=${expiry.toISOString()}`);
  if (resolutionCriteria) {
    console.log(`    description: ${resolutionCriteria.slice(0, 80)}...`);
  }
}

async function handleBetPlaced(log: EvmLog): Promise<void> {
  const roomId = log.topics[1];
  const user = decodeAddress(log.topics[2]);
  const data = log.data.replace('0x', '');

  const side = parseInt(data.slice(0, 64), 16) === 0 ? 'moon' : 'jeet';
  const amount = decodeBigInt(data.slice(64, 128));
  const moonPool = decodeBigInt(data.slice(128, 192));
  const jeetPool = decodeBigInt(data.slice(192, 256));

  const existing = await prisma.bet.findFirst({ where: { roomPubkey: roomId, userPubkey: user, side } });
  if (existing) {
    await prisma.bet.update({ where: { id: existing.id }, data: { amount: existing.amount + amount, txSig: log.transactionHash } });
  } else {
    await prisma.bet.create({ data: { roomPubkey: roomId, userPubkey: user, side, amount, txSig: log.transactionHash } });
  }

  await prisma.room.update({
    where: { roomPubkey: roomId },
    data: { totalPool: { increment: amount } },
  }).catch(() => {});

  await cacheRoom(roomId, { moonPool: moonPool.toString(), jeetPool: jeetPool.toString() });
  console.log(`  [BetPlaced] room=${roomId.slice(0, 20)}... user=${user.slice(0, 16)}... side=${side} amount=${amount}`);
}

async function handleRoomSettled(log: EvmLog): Promise<void> {
  const roomId = log.topics[1];
  const data = log.data.replace('0x', '');

  const winnerInt = parseInt(data.slice(0, 64), 16);
  const winner = winnerInt === 2 ? 'draw' : (winnerInt === 0 ? 'moon' : 'jeet');
  const finalPrice = decodeInt64(data.slice(64, 128));
  const twapFinalPrice = decodeInt64(data.slice(128, 192));

  await prisma.room.update({
    where: { roomPubkey: roomId },
    data: { status: 'settled', winner, finalPrice: BigInt(finalPrice), twapFinalPrice: BigInt(twapFinalPrice), settledAt: new Date() }
  }).catch(() => {});

  await cacheRoom(roomId, { status: 'settled', winner, finalPrice: finalPrice.toString() });
  console.log(`  [RoomSettled] room=${roomId.slice(0, 20)}... winner=${winner}`);
}

async function main() {
  console.log('=== EVM Backfill Starting ===');
  console.log(`RPC: ${RPC_URL}`);
  console.log(`Contract: ${CONTRACT}`);

  // Connect Redis/DB
  await prisma.$connect();
  
  const latestHex = await rpcCall('eth_blockNumber', []);
  const latestBlock = parseInt(latestHex, 16);
  const startBlock = Math.max(0, latestBlock - LOOKBACK_BLOCKS);

  console.log(`Latest block: ${latestBlock}`);
  console.log(`Scanning from block: ${startBlock} (lookback: ${LOOKBACK_BLOCKS})`);
  console.log(`Total chunks: ~${Math.ceil((latestBlock - startBlock) / CHUNK_SIZE)}`);
  console.log('');

  let processed = 0;
  let roomsFound = 0;
  let betsFound = 0;
  let errors = 0;

  for (let from = startBlock; from <= latestBlock; from += CHUNK_SIZE) {
    const to = Math.min(from + CHUNK_SIZE - 1, latestBlock);
    const fromHex = '0x' + from.toString(16);
    const toHex = '0x' + to.toString(16);

    try {
      const logs: EvmLog[] = await rpcCall('eth_getLogs', [{
        address: CONTRACT,
        fromBlock: fromHex,
        toBlock: toHex,
      }]) || [];

      for (const log of logs) {
        const t0 = log.topics[0]?.toLowerCase();
        try {
          if (t0 === TOPICS.RoomCreated.toLowerCase()) {
            await handleRoomCreated(log);
            roomsFound++;
          } else if (t0 === TOPICS.BetPlaced.toLowerCase()) {
            await handleBetPlaced(log);
            betsFound++;
          } else if (t0 === TOPICS.RoomSettled.toLowerCase()) {
            await handleRoomSettled(log);
          }
        } catch (err: any) {
          console.error(`  [ERROR] ${log.transactionHash}: ${err.message}`);
          errors++;
        }
      }

      processed++;
      if (processed % 100 === 0) {
        const pct = Math.round(((from - startBlock) / (latestBlock - startBlock)) * 100);
        process.stdout.write(`Progress: ${pct}% (block ${from}/${latestBlock}) rooms=${roomsFound} bets=${betsFound}\r`);
      }
    } catch (err: any) {
      if (err.response?.data?.error?.message) {
        console.error(`\nChunk ${fromHex}-${toHex}: ${err.response.data.error.message}`);
      }
      errors++;
      await new Promise(r => setTimeout(r, 500)); // back off on error
    }

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 50));
  }

  // Update the evm:last_block in Redis so the live listener picks up from here
  await redis.set('evm:last_block', latestBlock.toString());

  console.log('\n');
  console.log('=== EVM Backfill Complete ===');
  console.log(`Rooms indexed: ${roomsFound}`);
  console.log(`Bets indexed: ${betsFound}`);
  console.log(`Errors: ${errors}`);
  console.log(`Redis evm:last_block set to: ${latestBlock}`);

  await prisma.$disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
