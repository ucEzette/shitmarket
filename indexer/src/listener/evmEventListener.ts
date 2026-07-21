/**
 * evmEventListener.ts
 *
 * Polls the Avalanche C-Chain RPC for events emitted by the ShitMarketCore solidity contract.
 * Decodes events natively and saves them to the PostgreSQL database via Prisma,
 * updating Redis for active room caches and WebSocket notifications.
 */

import axios from 'axios';
import { config } from '../config';
import { logger } from '../logger';
import { prisma } from '../db';
import { redis } from '../redis';
import {
  cacheRoom,
  publishRoomUpdate,
  updateLeaderboard,
} from '../redis';
import {
  roomsCreatedTotal,
  roomsSettledTotal,
  betsPlacedTotal,
  betsVolumeTotal,
  activeRoomsGauge,
} from '../metrics/prometheus';

// ─── Event Signatures (Keccak256 Hashes) ──────────────────────────────────────

const TOPICS = {
  RoomCreated: '0xf97c4c3d156ed53cd560336ada7fa3650fbf8776167b109f16d44f2272878015',
  BetPlaced: '0xcded998c66303d5ffd5e3e307d828cf41226e0a77e5f9dbff723ddb5f54b9b0b',
  RoomSettled: '0xf69da01a307d1f7792a3153a45a6f1f50277280d9eb0564e0d897c781fa2478b',
  RoomVoided: '0xc700f9b3899ea073a308b00842a3d7a20cc7f3e083dceb462ad6577b285eb9b7',
  WinningsClaimed: '0xac1dfcff29900d7010c04a6028e48814b8a49daf045127abd10a4636d1d49115',
  PositionListed: '0xdde80ab931786d5c9a0a9cb2d1a34d488150c5196d9309b25fe9cd916cd3c8b5',
  ListingCancelled: '0x1c322de047b60db5864515be8b0f87a0ed797d9444c60987063e1b6b9817a993',
  PositionBought: '0x0813a4e2c24216f76d3e7b8e9a1009bb0ffb9ada0e96f5138c50250480f18a9e',
  RoomDisputed: '0xf97251d8a349e5fc0584668f69630572c62b84745d4ba12858bc66ec3c4944a7',
  DisputeResolved: '0xc67910521cb7d2ce1cd596f3db1297455729f6b1ee412affeed08435f6237686',
  ReferralRegistered: '0x5f1ca2fcc108b751843a763e60d2201f593516109d7dbb1b700468f2d4190bb7',
  ReferralRewardsClaimed: '0x98741ecf35c5d20a8ed68dbd8540500684864a6c98c2a41a5844d0b3a2357d43',
};

interface EvmLog {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
  transactionHash: string;
}

let isRunning = false;
let lastProcessedBlock = 0;
let pollingInterval: NodeJS.Timeout | null = null;

// Helper to convert 32-byte EVM hex slot to dynamic string
function decodeString(dataHex: string, offset: number): string {
  // Offset in 32-byte words
  const dataOffset = parseInt(dataHex.slice(2 + offset * 64, 2 + (offset + 1) * 64), 16) * 2;
  const length = parseInt(dataHex.slice(2 + dataOffset, 2 + dataOffset + 64), 16);
  const textHex = dataHex.slice(2 + dataOffset + 64, 2 + dataOffset + 64 + length * 2);
  return Buffer.from(textHex, 'hex').toString('utf8').replace(/\0/g, '').trim();
}

// Helper to convert 32-byte EVM hex slot to address
function decodeAddress(hex: string): string {
  return '0x' + hex.slice(26).toLowerCase();
}

// Helper to convert 32-byte EVM hex slot to bigint
function decodeBigInt(hex: string): bigint {
  return BigInt('0x' + hex);
}

// Helper to convert 32-byte EVM hex slot to int64
function decodeInt64(hex: string): number {
  const big = BigInt('0x' + hex);
  // Handle two's complement for negative numbers
  if (big & (BigInt(1) << BigInt(63))) {
    return Number(big - (BigInt(1) << BigInt(64)));
  }
  return Number(big);
}

// ─── Event Handlers ───────────────────────────────────────────────────────────

async function handleRoomCreated(log: EvmLog) {
  const roomId = log.topics[1];
  const creator = decodeAddress(log.topics[2]);
  
  const data = log.data.replace('0x', '');
  // Fields in data payload:
  // [0]: tokenMint (bytes32)
  // [1]: nameOffset (bytes32)
  // [2]: chainIdOffset (bytes32)
  // [3]: openingPrice (int64)
  // [4]: expiryTimestamp (uint256)
  // [5]: oracle (address)
  // [6]: oracleFeeAmount (uint256)
  const tokenMint = '0x' + data.slice(0, 64).slice(24); // Remove padding
  const openingPrice = decodeInt64(data.slice(192, 256));
  const expiryTimestamp = decodeBigInt(data.slice(256, 320));
  const oracle = decodeAddress(data.slice(320, 384));
  const oracleFeeAmount = decodeBigInt(data.slice(384, 448));

  // Strings are dynamic, decoded from offsets
  const tokenName = decodeString(log.data, 7);
  const chainId = decodeString(log.data, 8);

  const expiry = new Date(Number(expiryTimestamp) * 1000);

  await prisma.room.upsert({
    where: { roomPubkey: roomId },
    create: {
      roomPubkey: roomId,
      tokenMint,
      priceFeed: 'evm-aggregated',
      tokenName,
      tokenSymbol: tokenName, // Fallback
      chainId,
      originalAddress: tokenMint,
      duration: 5, // Fallback
      openingPrice: BigInt(openingPrice),
      expiry,
      status: 'active',
      creator,
      oracleAddress: oracle,
      oracleFeeLamports: oracleFeeAmount,
    },
    update: {
      openingPrice: BigInt(openingPrice),
      expiry,
      oracleAddress: oracle,
      oracleFeeLamports: oracleFeeAmount,
    },
  });

  await cacheRoom(roomId, {
    status: 'active',
    tokenMint,
    tokenName,
    tokenSymbol: tokenName,
    openingPrice: openingPrice.toString(),
    moonPool: '0',
    jeetPool: '0',
    expiry: expiry.toISOString(),
  });

  await publishRoomUpdate(roomId, {
    type: 'RoomCreated',
    tokenName,
    tokenSymbol: tokenName,
    chainId,
    originalAddress: tokenMint,
    expiry: expiry.toISOString(),
  });

  roomsCreatedTotal.inc();
  const activeCount = await prisma.room.count({ where: { status: 'active' } });
  activeRoomsGauge.set(activeCount);

  logger.info({ msg: 'EVM RoomCreated indexed', roomId, tokenMint, openingPrice });
}

async function handleBetPlaced(log: EvmLog) {
  const roomId = log.topics[1];
  const user = decodeAddress(log.topics[2]);

  const data = log.data.replace('0x', '');
  const side = parseInt(data.slice(0, 64), 16) === 0 ? 'moon' : 'jeet';
  const amount = decodeBigInt(data.slice(64, 128));
  const moonPool = decodeBigInt(data.slice(128, 192));
  const jeetPool = decodeBigInt(data.slice(192, 256));

  const existing = await prisma.bet.findFirst({
    where: { roomPubkey: roomId, userPubkey: user, side },
  });

  if (existing) {
    await prisma.bet.update({
      where: { id: existing.id },
      data: { amount: existing.amount + amount, txSig: log.transactionHash },
    });
  } else {
    await prisma.bet.create({
      data: { roomPubkey: roomId, userPubkey: user, side, amount, txSig: log.transactionHash },
    });
  }

  await prisma.room.update({
    where: { roomPubkey: roomId },
    data: { totalPool: { increment: amount } },
  });

  await cacheRoom(roomId, {
    moonPool: moonPool.toString(),
    jeetPool: jeetPool.toString(),
  });

  await publishRoomUpdate(roomId, {
    type: 'BetPlaced',
    user,
    side,
    amount: amount.toString(),
    moonPool: moonPool.toString(),
    jeetPool: jeetPool.toString(),
  });

  betsPlacedTotal.inc({ side });
  betsVolumeTotal.inc(Number(amount));

  logger.info({ msg: 'EVM BetPlaced indexed', roomId, user, side, amount: amount.toString() });
}

async function handleRoomSettled(log: EvmLog) {
  const roomId = log.topics[1];
  const data = log.data.replace('0x', '');
  
  const winnerInt = parseInt(data.slice(0, 64), 16);
  const winner = winnerInt === 2 ? 'draw' : (winnerInt === 0 ? 'moon' : 'jeet');
  const finalPrice = decodeInt64(data.slice(64, 128));
  const twapFinalPrice = decodeInt64(data.slice(128, 192));
  const totalPool = decodeBigInt(data.slice(192, 256));
  const platformFee = decodeBigInt(data.slice(256, 320));

  const isDraw = winner === 'draw';
  const winningBets = isDraw 
    ? await prisma.bet.findMany({ where: { roomPubkey: roomId } })
    : await prisma.bet.findMany({ where: { roomPubkey: roomId, side: winner } });

  const payoutPool = totalPool - platformFee;
  const winningPool = isDraw ? totalPool : winningBets.reduce((sum, b) => sum + b.amount, BigInt(0));

  const payoutOps = winningBets.map(bet => {
    if (winningPool === BigInt(0)) return Promise.resolve();
    const payout = (bet.amount * payoutPool) / winningPool;
    return prisma.payout.upsert({
      where: { roomPubkey_userPubkey: { roomPubkey: roomId, userPubkey: bet.userPubkey } },
      create: { roomPubkey: roomId, userPubkey: bet.userPubkey, amount: payout },
      update: { amount: payout },
    });
  });
  await Promise.all(payoutOps);

  const losingBets = isDraw 
    ? [] 
    : await prisma.bet.findMany({ where: { roomPubkey: roomId, side: winner === 'moon' ? 'jeet' : 'moon' } });

  const loserOps = losingBets.map(bet =>
    prisma.userProfile.upsert({
      where: { userPubkey: bet.userPubkey },
      create: { userPubkey: bet.userPubkey, losses: 1, profit: -bet.amount },
      update: { losses: { increment: 1 }, profit: { decrement: bet.amount } },
    })
  );
  await Promise.all(loserOps);
  await Promise.all(losingBets.map(bet => updateLeaderboard(bet.userPubkey, -bet.amount)));

  await prisma.room.update({
    where: { roomPubkey: roomId },
    data: {
      status: 'settled',
      winner,
      finalPrice: BigInt(finalPrice),
      twapFinalPrice: BigInt(twapFinalPrice),
      platformFee,
      settledAt: new Date(),
    },
  });

  await cacheRoom(roomId, {
    status: 'settled',
    winner,
    finalPrice: finalPrice.toString(),
    twapFinalPrice: twapFinalPrice.toString(),
  });

  await publishRoomUpdate(roomId, {
    type: 'RoomSettled',
    winner,
    finalPrice: finalPrice.toString(),
    twapFinalPrice: twapFinalPrice.toString(),
    totalPool: totalPool.toString(),
    platformFee: platformFee.toString(),
  });

  roomsSettledTotal.inc({ winner });
  const activeCount = await prisma.room.count({ where: { status: 'active' } });
  activeRoomsGauge.set(activeCount);

  logger.info({ msg: 'EVM RoomSettled indexed', roomId, winner, finalPrice, twapFinalPrice });
}

// ─── Polling Loop ─────────────────────────────────────────────────────────────

async function pollEvmLogs() {
  try {
    const payload = {
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_blockNumber',
      params: [],
    };
    const { data: resBlock } = await axios.post(config.evm.rpcUrl, payload, { timeout: 3000 });
    const latestHex = resBlock?.result;
    if (!latestHex) return;
    const latestBlock = parseInt(latestHex, 16);

    if (lastProcessedBlock === 0) {
      lastProcessedBlock = latestBlock - 50; // default lookback limit
    }

    if (latestBlock <= lastProcessedBlock) return;

    const fromBlock = lastProcessedBlock + 1;
    const toBlock = latestBlock;

    logger.debug({ msg: 'Polling EVM blocks', fromBlock, toBlock });

    const logsPayload = {
      jsonrpc: '2.0',
      id: 2,
      method: 'eth_getLogs',
      params: [
        {
          address: config.evm.contractAddress,
          fromBlock: '0x' + fromBlock.toString(16),
          toBlock: '0x' + toBlock.toString(16),
        },
      ],
    };

    const { data: resLogs } = await axios.post(config.evm.rpcUrl, logsPayload, { timeout: 5000 });
    const logs: EvmLog[] = resLogs?.result || [];

    for (const log of logs) {
      const topic0 = log.topics[0]?.toLowerCase();
      try {
        if (topic0 === TOPICS.RoomCreated.toLowerCase()) {
          await handleRoomCreated(log);
        } else if (topic0 === TOPICS.BetPlaced.toLowerCase()) {
          await handleBetPlaced(log);
        } else if (topic0 === TOPICS.RoomSettled.toLowerCase()) {
          await handleRoomSettled(log);
        }
      } catch (err: any) {
        logger.error({ msg: 'Error processing EVM log', txHash: log.transactionHash, err: err?.message });
      }
    }

    lastProcessedBlock = latestBlock;
    await redis.set('evm:last_block', lastProcessedBlock.toString());
  } catch (err: any) {
    logger.error({ msg: 'EVM log poller cycle failed', err: err?.message });
  }
}

// ─── Public Control API ───────────────────────────────────────────────────────

export async function startEvmListener(): Promise<void> {
  if (isRunning) return;
  isRunning = true;

  // Retrieve last block from cache
  const cachedBlock = await redis.get('evm:last_block');
  if (cachedBlock) {
    lastProcessedBlock = parseInt(cachedBlock, 10);
  }

  logger.info({
    msg: 'EVM Event Listener started',
    rpcUrl: config.evm.rpcUrl,
    contract: config.evm.contractAddress,
    startBlock: lastProcessedBlock,
  });

  // Run poll immediately then schedule
  await pollEvmLogs();
  pollingInterval = setInterval(pollEvmLogs, 5000);
}

export async function stopEvmListener(): Promise<void> {
  if (!isRunning) return;
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
  isRunning = false;
  logger.info('EVM Event Listener stopped');
}
