/**
 * evmEventListener.ts
 *
 * Polls the RPC for events emitted by the MarketFactory, OracleRegistry, and AMPool contracts.
 * Decodes events natively via Viem and saves them to the PostgreSQL database via Prisma,
 * updating Redis for active room caches and WebSocket notifications.
 */

import axios from 'axios';
import { config } from '../config';
import { logger } from '../logger';
import { prisma } from '../db';
import { redis, cacheRoom, publishRoomUpdate, updateLeaderboard } from '../redis';
import { createPublicClient, http, decodeEventLog } from 'viem';
import { avalancheFuji } from 'viem/chains';
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
  
  // New evolved contract events
  MarketCreated: '0x867a25cf41e7129dc45ae631b2a0c2fa1a0337320b006bb53642c6f36c5f313d',
  MarketResolved: '0x6dfc24f0f2fb42e49fb4fa3ffa8abb148cab908a1fb8335b3f128a08b2594af1',
  PoolCreated: '0x8e3244639df4bfff2e524c5327de26f3d7e525c4d458add3e9ce63f98e8fde28',
  Swap: '0xec9a01251436957128e2836cfc2674cdcef8618e093adaa9f9a3af79b9c4f4be',
  OutcomeReported: '0xacd3834a3dbaad4455e4fb60d1b9d4763b33dd529f4bd36d71335fe2b9e18a9b',
  OutcomeChallenged: '0xe56d33c4bd3987a9695c90e088431834f61995543c0531546dfa1a72f3517119',
  DisputeSettled: '0xd4390d9b1eae30d53d6e598d7eba50e60f3ea18310ca83e7919e3df177bb05ca',
  LiquidityAdded: '0xac1d76749e5447b7b16f5ab61447e1bd502f3bb4807af3b28e620d1700a6ee45',
  LiquidityRemoved: '0x96cd817c6329656790ef8fba7675405193677d39619571282f5e21f3a98cd059',
  PositionRedeemed: '0xcc001fe5ce00e937669e474bc7885c63d32fdd2c8bc0f56c96c6faa9078ce83d'
};

const FACTORY_ABI = [
  {
    name: "MarketCreated",
    type: "event",
    inputs: [
      { name: "marketId", type: "uint256", indexed: true },
      { name: "conditionId", type: "bytes32", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "ipfsHash", type: "string" },
      { name: "outcomeCount", type: "uint256" },
      { name: "oracle", type: "address" },
      { name: "resolutionTime", type: "uint256" }
    ]
  },
  {
    name: "MarketResolved",
    type: "event",
    inputs: [
      { name: "marketId", type: "uint256", indexed: true },
      { name: "winningOutcomeIndex", type: "uint256" }
    ]
  }
] as const;

const REGISTRY_ABI = [
  {
    name: "OutcomeReported",
    type: "event",
    inputs: [
      { name: "marketId", type: "uint256", indexed: true },
      { name: "reporter", type: "address", indexed: true },
      { name: "outcomeIndex", type: "uint256" }
    ]
  },
  {
    name: "OutcomeChallenged",
    type: "event",
    inputs: [
      { name: "marketId", type: "uint256", indexed: true },
      { name: "challenger", type: "address", indexed: true },
      { name: "outcomeIndex", type: "uint256" },
      { name: "bondAmount", type: "uint256" }
    ]
  },
  {
    name: "DisputeSettled",
    type: "event",
    inputs: [
      { name: "marketId", type: "uint256", indexed: true },
      { name: "finalOutcomeIndex", type: "uint256" },
      { name: "overturned", type: "bool" }
    ]
  }
] as const;

const AM_POOL_ABI = [
  {
    name: "Swap",
    type: "event",
    inputs: [
      { name: "swapper", type: "address", indexed: true },
      { name: "outcomeIndex", type: "uint8" },
      { name: "usdcSpent", type: "uint256" },
      { name: "sharesReceived", type: "uint256" },
      { name: "reserveYES", type: "uint256" },
      { name: "reserveNO", type: "uint256" }
    ]
  }
] as const;

const CONDITIONAL_TOKENS_ABI = [
  {
    name: "PositionRedeemed",
    type: "event",
    inputs: [
      { name: "stakeholder", type: "address", indexed: true },
      { name: "conditionId", type: "bytes32", indexed: true },
      { name: "winningOutcomeIndex", type: "uint256" },
      { name: "amount", type: "uint256" }
    ]
  }
] as const;

const publicClient = createPublicClient({
  chain: avalancheFuji,
  transport: http(config.evm.rpcUrl)
});

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
  if (big & (BigInt(1) << BigInt(63))) {
    return Number(big - (BigInt(1) << BigInt(64)));
  }
  return Number(big);
}

// Helper to convert 32-byte EVM hex slot to string
function decodeString(dataHex: string, offset: number): string {
  const dataOffset = parseInt(dataHex.slice(2 + offset * 64, 2 + (offset + 1) * 64), 16) * 2;
  const length = parseInt(dataHex.slice(2 + dataOffset, 2 + dataOffset + 64), 16);
  const textHex = dataHex.slice(2 + dataOffset + 64, 2 + dataOffset + 64 + length * 2);
  return Buffer.from(textHex, 'hex').toString('utf8').replace(/\0/g, '').trim();
}

// ─── Event Handlers ───────────────────────────────────────────────────────────

async function handleRoomCreated(log: EvmLog) {
  const roomId = log.topics[1];
  const creator = decodeAddress(log.topics[2]);
  
  const data = log.data.replace('0x', '');
  const tokenMint = '0x' + data.slice(0, 64).slice(24).toLowerCase();
  const openingPrice = decodeInt64(data.slice(3 * 64, 4 * 64));
  const expiryTimestamp = decodeBigInt(data.slice(4 * 64, 5 * 64));
  const oracle = decodeAddress(data.slice(5 * 64, 6 * 64));
  const oracleFeeAmount = decodeBigInt(data.slice(6 * 64, 7 * 64));

  let rawTokenName = '';
  let rawChainId = 'avalanche';
  try { rawTokenName = decodeString(log.data, 1); } catch {}
  try { rawChainId = decodeString(log.data, 2) || 'avalanche'; } catch {}

  const resolutionCriteria = rawTokenName.slice(0, 500);
  const tokenName = rawTokenName.length > 40
    ? rawTokenName.slice(0, 37).trim() + '...'
    : rawTokenName || 'Debate Market';
  const tokenSymbol = 'DEBATE';
  const chainId = rawChainId.slice(0, 20);

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
      duration: 5,
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

  await publishRoomUpdate(roomId, {
    type: 'RoomCreated',
    tokenName,
    tokenSymbol,
    chainId,
    originalAddress: tokenMint,
    expiry: expiry.toISOString(),
  });

  roomsCreatedTotal.inc();
  const activeCount = await prisma.room.count({ where: { status: 'active' } });
  activeRoomsGauge.set(activeCount);
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
}

// ─── Evolved Market Factory Event Handlers ─────────────────────────────────────

async function handleMarketCreated(log: EvmLog) {
  const decoded = decodeEventLog({
    abi: FACTORY_ABI,
    data: log.data as `0x${string}`,
    topics: log.topics as any
  }) as any;
  const { marketId, conditionId, creator, ipfsHash, oracle, resolutionTime } = decoded.args;

  const expiry = new Date(Number(resolutionTime) * 1000);
  const roomId = conditionId;

  await prisma.room.upsert({
    where: { roomPubkey: roomId },
    create: {
      roomPubkey: roomId,
      tokenMint: conditionId,
      priceFeed: 'evm-market-factory',
      tokenName: `Market #${marketId}`,
      tokenSymbol: 'PVP',
      chainId: 'avalanche',
      originalAddress: marketId.toString(),
      duration: 5,
      openingPrice: BigInt(500000), // 0.50 USDC
      expiry,
      status: 'active',
      creator: creator.toLowerCase(),
      oracleAddress: oracle.toLowerCase(),
      oracleFeeLamports: BigInt(0),
      resolutionCriteria: ipfsHash,
    },
    update: {
      expiry,
      oracleAddress: oracle.toLowerCase(),
      resolutionCriteria: ipfsHash,
    },
  });

  await cacheRoom(roomId, {
    status: 'active',
    tokenMint: conditionId,
    tokenName: `Market #${marketId}`,
    tokenSymbol: 'PVP',
    openingPrice: '500000',
    moonPool: '0',
    jeetPool: '0',
    expiry: expiry.toISOString(),
  });

  await publishRoomUpdate(roomId, {
    type: 'RoomCreated',
    tokenName: `Market #${marketId}`,
    tokenSymbol: 'PVP',
    chainId: 'avalanche',
    originalAddress: conditionId,
    expiry: expiry.toISOString(),
  });

  logger.info({ msg: 'MarketCreated indexed', marketId: marketId.toString(), conditionId });
}

async function handleMarketResolved(log: EvmLog) {
  const decoded = decodeEventLog({
    abi: FACTORY_ABI,
    data: log.data as `0x${string}`,
    topics: log.topics as any
  }) as any;
  const { marketId, winningOutcomeIndex } = decoded.args;

  const winner = winningOutcomeIndex === 0 ? 'moon' : 'jeet';

  const targetRoom = await prisma.room.findFirst({
    where: { originalAddress: marketId.toString() }
  });

  if (targetRoom) {
    const roomId = targetRoom.roomPubkey;
    await prisma.room.update({
      where: { roomPubkey: roomId },
      data: {
        status: 'settled',
        winner,
        settledAt: new Date(),
      },
    });

    await cacheRoom(roomId, {
      status: 'settled',
      winner,
    });

    await publishRoomUpdate(roomId, {
      type: 'RoomSettled',
      winner,
      totalPool: targetRoom.totalPool.toString(),
      platformFee: '0',
    });

    logger.info({ msg: 'MarketResolved indexed', marketId: marketId.toString(), winner });
  }
}

async function handleSwap(log: EvmLog) {
  const decoded = decodeEventLog({
    abi: AM_POOL_ABI,
    data: log.data as `0x${string}`,
    topics: log.topics as any
  }) as any;
  const { swapper, outcomeIndex, usdcSpent, reserveYES, reserveNO } = decoded.args;

  let conditionId: string | null = null;
  try {
    conditionId = await publicClient.readContract({
      address: log.address as `0x${string}`,
      abi: [
        {
          name: "conditionId",
          type: "function",
          inputs: [],
          outputs: [{ name: "conditionId", type: "bytes32" }]
        }
      ] as const,
      functionName: "conditionId"
    } as any) as string;
  } catch (err) {
    logger.warn({ msg: 'Failed to read conditionId from pool', pool: log.address, err });
  }

  if (conditionId) {
    const roomId = conditionId;
    const amount = BigInt(usdcSpent);
    const side = outcomeIndex === 0 ? 'moon' : 'jeet';

    // Log the Bet in Prisma
    await prisma.bet.create({
      data: {
        roomPubkey: roomId,
        userPubkey: swapper.toLowerCase(),
        side,
        amount,
        txSig: log.transactionHash
      }
    });

    await prisma.room.update({
      where: { roomPubkey: roomId },
      data: {
        totalPool: { increment: amount }
      }
    });

    await cacheRoom(roomId, {
      moonPool: reserveYES.toString(),
      jeetPool: reserveNO.toString(),
    });

    await publishRoomUpdate(roomId, {
      type: 'BetPlaced',
      user: swapper.toLowerCase(),
      side,
      amount: amount.toString(),
      moonPool: reserveYES.toString(),
      jeetPool: reserveNO.toString(),
    });

    logger.info({ msg: 'EVM AMM Swap indexed', pool: log.address, swapper, side, amount: amount.toString() });
  }
}

async function handlePositionRedeemed(log: EvmLog) {
  const decoded = decodeEventLog({
    abi: CONDITIONAL_TOKENS_ABI,
    data: log.data as `0x${string}`,
    topics: log.topics as any
  }) as any;
  const { stakeholder, conditionId, winningOutcomeIndex, amount } = decoded.args;

  const roomPubkey = conditionId;
  const userPubkey = stakeholder.toLowerCase();
  const amountClaimed = BigInt(amount);

  logger.info({ msg: 'EVM PositionRedeemed received', roomPubkey, userPubkey, amount: amountClaimed.toString() });

  // 1. Mark payout as claimed
  await prisma.payout.updateMany({
    where: { roomPubkey, userPubkey },
    data: { claimedAt: new Date() },
  });

  // Also mark user's bets as claimed in this room
  await prisma.bet.updateMany({
    where: { roomPubkey, userPubkey },
    data: { claimed: true }
  });

  // 2. Update user profile: wins + profit
  const userBets = await prisma.bet.findMany({
    where: { roomPubkey, userPubkey },
  });
  const totalBetAmount = userBets.reduce((sum, b) => sum + b.amount, BigInt(0));
  const profitGain = totalBetAmount > BigInt(0) ? amountClaimed - totalBetAmount : amountClaimed;

  await prisma.userProfile.upsert({
    where: { userPubkey },
    create: {
      userPubkey,
      wins: 1,
      profit: profitGain,
    },
    update: {
      wins: { increment: 1 },
      profit: { increment: profitGain },
    },
  });

  await updateLeaderboard(userPubkey, profitGain);

  await publishRoomUpdate(roomPubkey, {
    type: 'WinningsClaimed',
    user: userPubkey,
    amount: amountClaimed.toString(),
  });

  logger.info({ msg: 'EVM PositionRedeemed processed and synced successfully', roomPubkey, userPubkey });
}

async function handleLiquidityAddedOrRemoved(log: EvmLog) {
  let conditionId: string | null = null;
  try {
    conditionId = await publicClient.readContract({
      address: log.address as `0x${string}`,
      abi: [
        {
          name: "conditionId",
          type: "function",
          inputs: [],
          outputs: [{ name: "conditionId", type: "bytes32" }]
        }
      ] as const,
      functionName: "conditionId"
    } as any) as string;
  } catch (err) {
    logger.warn({ msg: 'Failed to read conditionId from pool during liquidity event', pool: log.address, err });
    return;
  }

  if (conditionId) {
    const roomId = conditionId;
    try {
      const reserve0 = await publicClient.readContract({
        address: log.address as `0x${string}`,
        abi: [{
          name: 'reserves',
          type: 'function',
          stateMutability: 'view',
          inputs: [{ name: '', type: 'uint256' }],
          outputs: [{ name: '', type: 'uint256' }]
        }] as const,
        functionName: 'reserves',
        args: [BigInt(0)]
      } as any) as bigint;
      const reserve1 = await publicClient.readContract({
        address: log.address as `0x${string}`,
        abi: [{
          name: 'reserves',
          type: 'function',
          stateMutability: 'view',
          inputs: [{ name: '', type: 'uint256' }],
          outputs: [{ name: '', type: 'uint256' }]
        }] as const,
        functionName: 'reserves',
        args: [BigInt(1)]
      } as any) as bigint;

      const totalPool = reserve0 + reserve1;
      await prisma.room.update({
        where: { roomPubkey: roomId },
        data: {
          totalPool
        }
      });

      await cacheRoom(roomId, {
        moonPool: reserve0.toString(),
        jeetPool: reserve1.toString(),
      });

      await publishRoomUpdate(roomId, {
        type: 'PoolLiquidityUpdated',
        moonPool: reserve0.toString(),
        jeetPool: reserve1.toString(),
      });

      logger.info({ msg: 'EVM Pool Liquidity sync complete', pool: log.address, reserve0: reserve0.toString(), reserve1: reserve1.toString() });
    } catch (err) {
      logger.error({ msg: 'Failed to sync EVM pool reserves on liquidity event', pool: log.address, err });
    }
  }
}

async function handleOutcomeReported(log: EvmLog) {
  const decoded = decodeEventLog({
    abi: REGISTRY_ABI,
    data: log.data as `0x${string}`,
    topics: log.topics as any
  }) as any;
  const { marketId, reporter, outcomeIndex } = decoded.args;

  const targetRoom = await prisma.room.findFirst({
    where: { originalAddress: marketId.toString() }
  });

  if (targetRoom) {
    await prisma.room.update({
      where: { roomPubkey: targetRoom.roomPubkey },
      data: {
        disputeStatus: 0,
        oracleLogs: `Reported outcome: ${outcomeIndex} by ${reporter}`,
      }
    });
    logger.info({ msg: 'OutcomeReported indexed', marketId: marketId.toString(), reporter });
  }
}

async function handleOutcomeChallenged(log: EvmLog) {
  const decoded = decodeEventLog({
    abi: REGISTRY_ABI,
    data: log.data as `0x${string}`,
    topics: log.topics as any
  }) as any;
  const { marketId, challenger, bondAmount } = decoded.args;

  const targetRoom = await prisma.room.findFirst({
    where: { originalAddress: marketId.toString() }
  });

  if (targetRoom) {
    await prisma.room.update({
      where: { roomPubkey: targetRoom.roomPubkey },
      data: {
        status: 'disputed',
        disputedAt: new Date(),
        disputeChallenger: challenger.toLowerCase(),
        disputeBond: BigInt(bondAmount),
      }
    });

    await publishRoomUpdate(targetRoom.roomPubkey, {
      type: 'RoomDisputed',
      challenger: challenger.toLowerCase(),
      bondAmount: bondAmount.toString(),
    });

    logger.info({ msg: 'OutcomeChallenged indexed', marketId: marketId.toString(), challenger });
  }
}

async function handleDisputeSettled(log: EvmLog) {
  const decoded = decodeEventLog({
    abi: REGISTRY_ABI,
    data: log.data as `0x${string}`,
    topics: log.topics as any
  }) as any;
  const { marketId, finalOutcomeIndex, overturned } = decoded.args;

  const targetRoom = await prisma.room.findFirst({
    where: { originalAddress: marketId.toString() }
  });

  if (targetRoom) {
    const winner = finalOutcomeIndex === 0 ? 'moon' : 'jeet';
    await prisma.room.update({
      where: { roomPubkey: targetRoom.roomPubkey },
      data: {
        status: 'settled',
        winner,
        disputeStatus: overturned ? 1 : 0,
        settledAt: new Date(),
      }
    });

    await cacheRoom(targetRoom.roomPubkey, {
      status: 'settled',
      winner,
    });

    await publishRoomUpdate(targetRoom.roomPubkey, {
      type: 'RoomSettled',
      winner,
      totalPool: targetRoom.totalPool.toString(),
      platformFee: '0',
    });

    logger.info({ msg: 'DisputeSettled indexed', marketId: marketId.toString(), winner });
  }
}

// ─── Polling Loop ─────────────────────────────────────────────────────────────

async function pollEvmLogs() {
  try {
    const payload = {
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_blockNumber',
      params: [] as any[],
    };
    const { data: resBlock } = await axios.post(config.evm.rpcUrl, payload, { timeout: 10000 });
    const latestHex = resBlock?.result;
    if (!latestHex) return;
    const latestBlock = parseInt(latestHex, 16);

    if (lastProcessedBlock === 0) {
      const deployBlock = parseInt(process.env.EVM_DEPLOYMENT_BLOCK || '0', 10);
      lastProcessedBlock = deployBlock > 0 ? deployBlock - 1 : Math.max(0, latestBlock - 10000);
      logger.info({ msg: 'EVM listener cold start', fromBlock: lastProcessedBlock, deployBlock });
    }

    if (latestBlock <= lastProcessedBlock) return;

    const fromBlock = lastProcessedBlock + 1;
    const toBlock = latestBlock;

    logger.debug({ msg: 'Polling EVM blocks', fromBlock, toBlock });

    const CHUNK_SIZE = 500;
    const allLogs: EvmLog[] = [];
    for (let chunkFrom = fromBlock; chunkFrom <= toBlock; chunkFrom += CHUNK_SIZE) {
      const chunkTo = Math.min(chunkFrom + CHUNK_SIZE - 1, toBlock);
      const logsPayload = {
        jsonrpc: '2.0',
        id: 2,
        method: 'eth_getLogs',
        params: [
          {
            topics: [[
              TOPICS.RoomCreated,
              TOPICS.BetPlaced,
              TOPICS.RoomSettled,
              TOPICS.MarketCreated,
              TOPICS.MarketResolved,
              TOPICS.Swap,
              TOPICS.OutcomeReported,
              TOPICS.OutcomeChallenged,
              TOPICS.DisputeSettled,
              TOPICS.LiquidityAdded,
              TOPICS.LiquidityRemoved,
              TOPICS.PositionRedeemed
            ]],
            fromBlock: '0x' + chunkFrom.toString(16),
            toBlock: '0x' + chunkTo.toString(16),
          },
        ],
      };
      try {
        const { data: resLogs } = await axios.post(config.evm.rpcUrl, logsPayload, { timeout: 10000 });
        if (resLogs?.error) {
          logger.warn({ msg: 'eth_getLogs chunk error', error: resLogs.error.message, chunkFrom, chunkTo });
        } else {
          allLogs.push(...(resLogs?.result || []));
        }
      } catch (chunkErr: any) {
        logger.warn({ msg: 'eth_getLogs chunk failed', err: chunkErr?.message, chunkFrom, chunkTo });
      }
    }

    for (const log of allLogs) {
      const topic0 = log.topics[0]?.toLowerCase();
      try {
        if (topic0 === TOPICS.RoomCreated.toLowerCase()) {
          await handleRoomCreated(log);
        } else if (topic0 === TOPICS.BetPlaced.toLowerCase()) {
          await handleBetPlaced(log);
        } else if (topic0 === TOPICS.RoomSettled.toLowerCase()) {
          await handleRoomSettled(log);
        } else if (topic0 === TOPICS.MarketCreated.toLowerCase()) {
          await handleMarketCreated(log);
        } else if (topic0 === TOPICS.MarketResolved.toLowerCase()) {
          await handleMarketResolved(log);
        } else if (topic0 === TOPICS.Swap.toLowerCase()) {
          await handleSwap(log);
        } else if (topic0 === TOPICS.OutcomeReported.toLowerCase()) {
          await handleOutcomeReported(log);
        } else if (topic0 === TOPICS.OutcomeChallenged.toLowerCase()) {
          await handleOutcomeChallenged(log);
        } else if (topic0 === TOPICS.DisputeSettled.toLowerCase()) {
          await handleDisputeSettled(log);
        } else if (topic0 === TOPICS.PositionRedeemed.toLowerCase()) {
          await handlePositionRedeemed(log);
        } else if (
          topic0 === TOPICS.LiquidityAdded.toLowerCase() ||
          topic0 === TOPICS.LiquidityRemoved.toLowerCase()
        ) {
          await handleLiquidityAddedOrRemoved(log);
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

  const cachedBlock = await redis.get('evm:last_block');
  if (cachedBlock) {
    lastProcessedBlock = parseInt(cachedBlock, 10);
  }

  logger.info({
    msg: 'EVM Event Listener started',
    rpcUrl: config.evm.rpcUrl,
    startBlock: lastProcessedBlock,
  });

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
