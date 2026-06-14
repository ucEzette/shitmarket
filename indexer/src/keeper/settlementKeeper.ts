/**
 * settlementKeeper.ts
 *
 * Periodic job (every 3s) that finds expired-but-unsettled rooms and
 * submits the settle_room instruction signed by the keeper wallet.
 *
 * Uses distributed Redis locks (keeperLock.ts) to prevent duplicate
 * settlement attempts in multi-keeper deployments.
 *
 * Architecture:
 * - Queries Postgres for active rooms past their expiry.
 * - Acquires a Redis lock per room (avoids keeper races).
 * - Aggregates the current price from DexScreener + Birdeye (median).
 * - Signs and sends settle_room via Anchor's program.methods API.
 * - Releases the lock after settlement attempt.
 * - Errors (already settled, RPC timeout) are caught and logged; the
 *   event listener handles DB updates when the tx confirms.
 *
 * Phase 3.1: Added Switchboard feed support for multi-oracle settlement.
 * Phase 3.2: Passes historical TWAP samples along with settlement price.
 */

import * as anchor from '@coral-xyz/anchor';
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
} from '@solana/web3.js';
import cron from 'node-cron';
import bs58 from 'bs58';

import { config } from '../config';
import { logger } from '../logger';
import { prisma } from '../db';
import { aggregatePrice, mockAggregatePrice } from '../feeds/priceAggregator';
import { calculatePythTwap } from '../feeds/pythTwap';
import { updateEloAfterSettlement } from '../elo';
import {
  keeperSuccessTotal,
  keeperFailureTotal,
} from '../metrics/prometheus';
import { acquireRoomLock, releaseLock } from './keeperLock';

// ─── Keeper wallet ────────────────────────────────────────────────────────────

export function extractErrorMessage(err: any): string {
  if (!err) return 'Unknown error';
  if (typeof err === 'string') return err;
  if (err.message && typeof err.message === 'string') return err.message;
  if (err.error && typeof err.error.message === 'string') return err.error.message;
  if (Array.isArray(err.logs) && err.logs.length > 0) {
    for (const log of err.logs) {
      if (log.includes('AnchorError') || log.includes('Error Message:')) {
        return log.replace('Program log: ', '');
      }
    }
    return `Logs: ${err.logs.slice(-3).join(' | ')}`;
  }
  try {
    const cleanObj: any = {};
    if (err.code !== undefined) cleanObj.code = err.code;
    if (err.type !== undefined) cleanObj.type = err.type;
    if (err.InstructionError !== undefined) cleanObj.InstructionError = err.InstructionError;
    if (err.err !== undefined) cleanObj.err = err.err;
    if (Object.keys(cleanObj).length > 0) return JSON.stringify(cleanObj);
    const str = JSON.stringify(err);
    if (str && str !== '{}') return str.length > 200 ? str.slice(0, 200) + '...' : str;
  } catch {}
  return String(err);
}

let activeConnection: Connection | null = null;
let activeProgram: anchor.Program | null = null;
let cachedTreasury: PublicKey | null = null;

interface SettlementKeeperStatus {
  isRunning: boolean;
  lastSweepAt: string | null;
  lastSweepDurationMs: number | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastError: string | null;
  lastRoomCount: number;
  lastResult: 'idle' | 'success' | 'failure';
}

const settlementKeeperStatus: SettlementKeeperStatus = {
  isRunning: false,
  lastSweepAt: null,
  lastSweepDurationMs: null,
  lastSuccessAt: null,
  lastFailureAt: null,
  lastError: null,
  lastRoomCount: 0,
  lastResult: 'idle',
};

export function getSettlementKeeperStatus(): SettlementKeeperStatus {
  return { ...settlementKeeperStatus };
}

function loadKeeperKeypair(): Keypair {
  const raw = config.solana.keeperPrivateKey;
  try {
    // Support both JSON array format and base58 format
    if (raw.startsWith('[')) {
      const arr: number[] = JSON.parse(raw);
      return Keypair.fromSecretKey(Uint8Array.from(arr));
    }
    return Keypair.fromSecretKey(new Uint8Array(bs58.decode(raw)));
  } catch (err) {
    throw new Error(`Invalid KEEPER_PRIVATE_KEY format: ${err}`);
  }
}

// ─── PDA derivation ───────────────────────────────────────────────────────────

function deriveRoomPda(tokenMint: PublicKey, creator: PublicKey, programId: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('room'), tokenMint.toBuffer(), creator.toBuffer()],
    programId
  );
  return pda;
}

function deriveEscrowPda(room: PublicKey, programId: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('escrow'), room.toBuffer()],
    programId
  );
  return pda;
}

function deriveVaultPda(programId: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync([
    Buffer.from('vault'),
  ], programId);
  return pda;
}

function deriveConfigPda(programId: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('platform_config')],
    programId
  );
  return pda;
}

function getRoomStatusFromAccount(roomAccount: any): string {
  return Object.keys(roomAccount.status ?? {})[0] ?? 'active';
}

function getWinnerFromRoomAccount(roomAccount: any): 'moon' | 'jeet' | 'draw' | null {
  const winnerKey = Object.keys(roomAccount.winner ?? {})[0];
  if (winnerKey === 'moon') return 'moon';
  if (winnerKey === 'jeet') return 'jeet';
  if (winnerKey === 'draw') return 'draw';
  return null;
}

function parseOptionalBigInt(value: any): bigint | null {
  if (value === null || value === undefined) return null;
  try {
    return BigInt(value.toString());
  } catch {
    return null;
  }
}

// ─── Core settlement logic ────────────────────────────────────────────────────

async function settleRoom(
  program: anchor.Program,
  connection: Connection,
  keeper: Keypair,
  roomRecord: {
    roomPubkey: string;
    tokenMint: string;
    openingPrice: bigint;
    priceFeed: string | null;
    switchboardFeed: string | null;
    expiry: Date;
  }
): Promise<string> {
  const roomPubkeyStr = roomRecord.roomPubkey;
  const roomPubkey = new PublicKey(roomPubkeyStr);
  const programId = program.programId;

  // 1. Acquire distributed lock (prevents multi-keeper races)
  const lockValue = await acquireRoomLock(roomPubkeyStr);
  if (!lockValue) {
    // Another keeper is handling this room
    return 'lock_held';
  }

  // Ensure lock is always released
  let lockReleased = false;
  const release = async () => {
    if (!lockReleased) {
      lockReleased = true;
      await releaseLock(roomPubkeyStr, lockValue);
    }
  };

  try {
    // Derive PDAs
    const configPda = deriveConfigPda(programId);
    const escrowPda = deriveEscrowPda(roomPubkey, programId);
    const vaultPda = deriveVaultPda(programId);

    // Validate vault PDA before sending settle_room, to catch any obvious program ID / account mismatch.
    const vaultInfo = await connection.getAccountInfo(vaultPda);
    if (!vaultInfo) {
      logger.warn({
        msg: 'Vault PDA does not exist on-chain yet. The program may create it implicitly during first settlement.',
        vault: vaultPda.toBase58(),
        programId: programId.toBase58(),
      });
    } else if (
      !vaultInfo.owner.equals(SystemProgram.programId) &&
      !vaultInfo.owner.equals(programId)
    ) {
      throw new Error(
        `Vault PDA owner mismatch: expected ${SystemProgram.programId.toBase58()} or ${programId.toBase58()}, got ${vaultInfo.owner.toBase58()}. ` +
        'The vault account must be either a system account or derived for this program ID.'
      );
    } else {
      logger.info({
        msg: 'Validated existing vault PDA for settle_room',
        vault: vaultPda.toBase58(),
        vaultOwner: vaultInfo.owner.toBase58(),
        programId: programId.toBase58(),
      });
    }

    // The on-chain settle_room instruction expects the vault PDA itself, not the configured treasury wallet.
    // The vault PDA may be created lazily by the first settlement transaction.
    if (!cachedTreasury) {
      try {
        const configAccount: any = await (program.account as any).platformConfig.fetch(configPda);
        cachedTreasury = configAccount.treasury;
      } catch (err: any) {
        logger.error({ msg: 'Failed to fetch platformConfig for treasury', err: err?.message });
      }
    }

    // Resolve Pyth feed ID (defaults to on-chain SystemProgram sentinel to bypass reverts for custom tokens)
    const pythFeedId =
      roomRecord.priceFeed ||
      (config.pythFeedMapping as Record<string, string>)[roomRecord.tokenMint] ||
      '11111111111111111111111111111111';

    // Phase 3.1: Resolve Switchboard feed
    const switchboardFeedStr =
      roomRecord.switchboardFeed ||
      (config.switchboardFeedMapping as Record<string, string>)[roomRecord.tokenMint];

    // Fetch historical TWAP samples from DB (Phase 3.2)
    const recentSamples = await prisma.priceSample.findMany({
      where: {
        tokenMint: roomRecord.tokenMint,
        createdAt: {
          gte: new Date(Date.now() - 300_000), // last 5 minutes
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const historicalSamples = recentSamples.map((s) => ({
      price: Number(s.price),
      timestamp: Math.floor(s.createdAt.getTime() / 1000),
    }));

    // Fetch room account from blockchain to check pools and on-chain status
    let roomAccount: any;
    try {
      roomAccount = await (program.account as any).room.fetch(roomPubkey);
    } catch (err: any) {
      logger.error({ msg: 'Failed to fetch room account from blockchain', room: roomPubkeyStr, err: err?.message });
      await release();
      throw err;
    }

    const roomStatus = getRoomStatusFromAccount(roomAccount);
    if (roomStatus === 'settled' || roomStatus === 'cancelled') {
      const onChainWinner = getWinnerFromRoomAccount(roomAccount);
      const finalPrice = parseOptionalBigInt(roomAccount.finalPrice);
      const twapFinalPrice = parseOptionalBigInt(roomAccount.twapFinalPrice);
      const platformFee = parseOptionalBigInt(roomAccount.platformFee);

      const updateData: any = {
        status: roomStatus === 'cancelled' ? 'cancelled' : 'settled',
      };
      if (onChainWinner) updateData.winner = onChainWinner;
      if (finalPrice !== null) updateData.finalPrice = finalPrice;
      if (twapFinalPrice !== null) updateData.twapFinalPrice = twapFinalPrice;
      if (platformFee !== null) updateData.platformFee = platformFee;

      await prisma.room.update({
        where: { roomPubkey: roomPubkeyStr },
        data: updateData,
      }).catch(() => {});

      logger.info({
        msg: 'Room already settled on-chain before keeper submission — syncing DB',
        room: roomPubkeyStr,
        roomStatus,
        onChainWinner,
      });

      await release();
      return 'already_settled';
    }

    const isOneSided = roomAccount.moonPool.isZero() || roomAccount.jeetPool.isZero();
    let finalPriceParam: anchor.BN | null = null;
    let result: any = null;
    let twapValue: number | null = null;

    if (isOneSided) {
      logger.info({
        msg: 'Room is one-sided (void path). Bypassing price aggregation.',
        room: roomPubkeyStr,
        moonPool: roomAccount.moonPool.toString(),
        jeetPool: roomAccount.jeetPool.toString(),
      });
    } else {
      result = await aggregatePrice(roomRecord.tokenMint, pythFeedId, historicalSamples);
      if (!result) {
        const isDevOrTest =
          config.nodeEnv === 'development' ||
          config.solana.rpcUrl.includes('devnet') ||
          config.solana.rpcUrl.includes('localhost') ||
          config.solana.rpcUrl.includes('127.0.0.1');

        if (isDevOrTest) {
          logger.info({
            msg: 'Price aggregation failed in test/development mode. Falling back to mockAggregatePrice.',
            room: roomPubkeyStr,
          });
          const openingPriceNum = Number(roomRecord.openingPrice);
          result = await mockAggregatePrice(roomRecord.tokenMint, openingPriceNum);
        } else {
          logger.error({ msg: 'Price aggregation failed — skipping room', room: roomPubkeyStr });
          keeperFailureTotal.inc();
          await release();
          throw new Error('Price aggregation failed for token settlement');
        }
      }

      if (pythFeedId && pythFeedId !== '11111111111111111111111111111111') {
        try {
          twapValue = await calculatePythTwap(pythFeedId, roomRecord.expiry.getTime(), 5);
        } catch (err: any) {
          logger.error({
            msg: 'Error calculating Pyth TWAP in settlement keeper',
            room: roomPubkeyStr,
            err: err?.message,
          });
        }
      }
    }

    logger.info({
      msg: isOneSided ? 'Submitting settle_room (void path)' : 'Submitting settle_room',
      room: roomPubkeyStr,
      priceFeed: pythFeedId,
      switchboardFeed: switchboardFeedStr || 'none',
      sources: result ? result.sources : ['void'],
      priceI64: result ? result.priceI64 : 0,
      twapPrice: twapValue !== null ? twapValue : (result ? result.twapPrice : undefined),
    });

    try {
      // Phase 3.1: Build account meta including optional switchboard feed
      const accounts: Record<string, PublicKey> = {
        room: roomPubkey,
        escrow: escrowPda,
        vault: vaultPda,
        priceFeed: new PublicKey(pythFeedId),
        switchboardFeed: switchboardFeedStr
          ? new PublicKey(switchboardFeedStr)
          : PublicKey.default, // Pubkey::default() means not used
        config: configPda,
        keeper: keeper.publicKey,
        systemProgram: SystemProgram.programId,
      };

      if (!isOneSided) {
        if (twapValue !== null) {
          const scaledPrice = Math.round(twapValue * 1_000_000_000_000);
          finalPriceParam = new anchor.BN(scaledPrice);
          logger.info({
            msg: 'Using Pyth TWAP price for settlement',
            room: roomPubkeyStr,
            twapPrice: twapValue,
            scaledPrice,
          });
        } else {
          const scaledPrice = result.priceI64 * 1_000_000;
          finalPriceParam = new anchor.BN(scaledPrice);
        }
      }

      const tx = await program.methods
        .settleRoom(finalPriceParam)
        .accounts(accounts)
        .transaction();

      tx.feePayer = keeper.publicKey;

      // Add Compute Budget limit & Priority Fee instructions to guarantee inclusion in congested blocks
      const modifyComputeBudget = anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({ 
        units: 100000 
      });
      const addPriorityFee = anchor.web3.ComputeBudgetProgram.setComputeUnitPrice({ 
        microLamports: 50000 
      });
      
      tx.add(modifyComputeBudget);
      tx.add(addPriorityFee);

      const txSig = await anchor.web3.sendAndConfirmTransaction(
        connection,
        tx,
        [keeper],
        { commitment: 'confirmed', skipPreflight: false }
      );

      logger.info({ msg: 'settle_room confirmed', room: roomPubkeyStr, txSig });
      keeperSuccessTotal.inc();

      // ── Phase 4.5: Update ELO for all participants ──────────────────────
      try {
        // Fetch all bets for this room to determine winners/losers
        const roomBets = await prisma.bet.findMany({
          where: { roomPubkey: roomPubkeyStr },
          select: { userPubkey: true, side: true },
        });

        // Fetch the room record to get winner and pool size
        const settledRoom = await prisma.room.findUnique({
          where: { roomPubkey: roomPubkeyStr },
          select: { winner: true, totalPool: true },
        });

        if (settledRoom && settledRoom.winner) {
          const winnerSide = settledRoom.winner; // 'moon' or 'jeet'
          const poolSizeLamports = settledRoom.totalPool;

          // Deduplicate users (a user may have multiple bets in a room)
          const processedUsers = new Set<string>();
          for (const bet of roomBets) {
            if (processedUsers.has(bet.userPubkey)) continue;
            processedUsers.add(bet.userPubkey);

            const won = bet.side === winnerSide;
            // Fire-and-forget — don't block settlement on ELO update
            updateEloAfterSettlement(bet.userPubkey, won, poolSizeLamports).catch(
              (eloErr: any) => {
                logger.error({
                  msg: 'ELO update failed (non-blocking)',
                  user: bet.userPubkey.slice(0, 8),
                  err: eloErr?.message,
                });
              }
            );
          }
        }
      } catch (eloErr: any) {
        // Non-blocking: log error but don't fail settlement
        logger.error({
          msg: 'ELO batch update failed (non-blocking)',
          room: roomPubkeyStr,
          err: eloErr?.message,
        });
      }

      return txSig;
    } catch (err: any) {
      const msg = extractErrorMessage(err);
      // Gracefully handle already-settled or not-active rooms (race condition, stale DB state)
      // IMPORTANT: Do NOT mark rooms as 'settled' in DB if the on-chain error is
      // InsufficientLiquidity — the room is still 'active' on-chain and the minimum
      // liquidity may be met later (e.g. a keeper with a different feed, or a manual
      // intervention). Marking it as 'settled' in DB creates an unrecoverable desync
      // where users see a settled room in the UI but can never claim their funds.
      if (msg.includes('RoomAlreadySettled') || msg.includes('6002')) {
        logger.info({ msg: 'Room already settled on-chain — marking settled in DB', room: roomPubkeyStr, error: msg });
        // Best-effort DB update
        await prisma.room.update({
          where: { roomPubkey: roomPubkeyStr },
          data: { status: 'settled' },
        }).catch(() => {});
        return 'already_settled';
      }
      
      if (msg.includes('RoomNotActive') || msg.includes('6000') || msg.includes('0x1770')) {
        logger.info({ msg: 'Room not active on-chain — skipping', room: roomPubkeyStr, error: msg });
        return 'not_active';
      }

      if (msg.includes('AccountOwnedByWrongProgram') || msg.includes('0xbbf') || msg.includes('3007')) {
        // Room belongs to an old program deployment — mark as settled in DB so the keeper stops retrying it.
        logger.warn({ msg: 'Room owned by a different program (old deployment) — marking settled in DB to stop retries', room: roomPubkeyStr });
        await prisma.room.update({
          where: { roomPubkey: roomPubkeyStr },
          data: { status: 'settled' },
        }).catch(() => {});
        return 'wrong_program';
      }
      
      if (msg.includes('InsufficientLiquidity') || msg.includes('6022') || msg.includes('0x1786')) {
        logger.info({ msg: 'Room insufficient liquidity on-chain — NOT marking as settled. Room remains active for retry.', room: roomPubkeyStr, error: msg });
        // DO NOT update DB status — let the keeper retry on the next tick
        return 'insufficient_liquidity';
      } else {
        logger.error({ msg: 'settle_room failed', room: roomPubkeyStr, err: msg });
        keeperFailureTotal.inc();
        throw err;
      }
    }
  } finally {
    await release();
  }
}

// ─── Keeper job ───────────────────────────────────────────────────────────────

export function startSettlementKeeper(
  connection: Connection,
  program: anchor.Program
): cron.ScheduledTask {
  activeConnection = connection;
  activeProgram = program;

  let keeper: Keypair;
  try {
    keeper = loadKeeperKeypair();
    logger.info({ msg: 'Keeper wallet loaded', pubkey: keeper.publicKey.toBase58() });
  } catch (err: any) {
    logger.error({ msg: 'Cannot start keeper — invalid wallet', err: err?.message });
    process.exit(1);
  }

  // Devnet rate limits are much stricter — slow down polling
  const isDevnet =
    config.solana.rpcUrl.includes('devnet') ||
    config.solana.rpcUrl.includes('localhost') ||
    config.solana.rpcUrl.includes('127.0.0.1');
  const cronExpr = isDevnet ? '*/10 * * * * *' : '*/2 * * * * *';
  const intervalLabel = isDevnet ? '10 seconds' : '2 seconds';

  settlementKeeperStatus.isRunning = true;

  // Run every N seconds
  const task = cron.schedule(cronExpr, async () => {
    const tickStart = Date.now();
    settlementKeeperStatus.lastSweepAt = new Date().toISOString();
    settlementKeeperStatus.lastRoomCount = 0;
    settlementKeeperStatus.lastError = null;
    settlementKeeperStatus.lastResult = 'idle';

    let expiredRooms: {
      roomPubkey: string;
      tokenMint: string;
      openingPrice: bigint;
      priceFeed: string | null;
      switchboardFeed: string | null;
      expiry: Date;
    }[];

    try {
      expiredRooms = await prisma.room.findMany({
        where: {
          status: 'active',
          expiry: { lte: new Date() },
        },
        select: {
          roomPubkey: true,
          tokenMint: true,
          openingPrice: true,
          priceFeed: true,
          switchboardFeed: true,
          expiry: true,
        },
        take: 10, // Process up to 10 rooms per tick to avoid thundering herd
      });

      settlementKeeperStatus.lastRoomCount = expiredRooms.length;

      if (expiredRooms.length === 0) {
        settlementKeeperStatus.lastSweepDurationMs = Date.now() - tickStart;
        settlementKeeperStatus.lastResult = 'success';
        return;
      }

      logger.info({ msg: 'Keeper found expired rooms', count: expiredRooms.length });

      // Settle concurrently but with a small cap
      await Promise.allSettled(
        expiredRooms.map((room) => settleRoom(program, connection, keeper, room))
      );

      settlementKeeperStatus.lastSuccessAt = new Date().toISOString();
      settlementKeeperStatus.lastResult = 'success';
    } catch (err: any) {
      settlementKeeperStatus.lastFailureAt = new Date().toISOString();
      settlementKeeperStatus.lastError = err?.message ?? String(err);
      settlementKeeperStatus.lastResult = 'failure';
      logger.error({ msg: 'Settlement keeper tick failed', err: err?.message, stack: err?.stack });
    } finally {
      settlementKeeperStatus.lastSweepDurationMs = Date.now() - tickStart;
    }
  });

  logger.info(`Settlement keeper started — running every ${intervalLabel}`);
  return task;
}

export async function settleRoomByPubkey(pubkeyStr: string): Promise<{ success: boolean; txSig?: string; error?: string }> {
  try {
    const roomRecord = await prisma.room.findUnique({
      where: { roomPubkey: pubkeyStr },
      select: {
        roomPubkey: true,
        tokenMint: true,
        openingPrice: true,
        priceFeed: true,
        switchboardFeed: true,
        status: true,
        expiry: true,
      },
    });

    if (!roomRecord) {
      return { success: false, error: 'Room not found in database' };
    }

    let connection = activeConnection;
    let program = activeProgram;

    if (!connection || !program) {
      logger.info({ msg: 'Initializing on-demand connection and program for settlement' });
      connection = new Connection(config.solana.rpcUrl, 'confirmed');
      const programId = new PublicKey(config.solana.programId);
      
      // Load IDL
      let idl: any;
      try {
        idl = require('../../../program/target/idl/shitmarket.json');
      } catch {
        try {
          idl = require('../utils/idl.json');
        } catch {
          throw new Error('Failed to load IDL for on-demand settlement');
        }
      }

      const wallet = new anchor.Wallet(anchor.web3.Keypair.generate());
      const provider = new anchor.AnchorProvider(connection, wallet, {
        commitment: 'confirmed',
      });
      
      const idlWithAddress = { ...idl, address: programId.toBase58() };
      
      function normalizeIdl(obj: any): void {
        if (Array.isArray(obj)) {
          obj.forEach(normalizeIdl);
        } else if (obj !== null && typeof obj === 'object') {
          for (const key in obj) {
            if (key === 'defined' && typeof obj[key] === 'string') {
              obj[key] = { name: obj[key] };
            } else {
              normalizeIdl(obj[key]);
            }
          }
        }
      }
      normalizeIdl(idlWithAddress);
      
      program = new anchor.Program(idlWithAddress as anchor.Idl, provider);
    }

    if (roomRecord.status !== 'settled' && roomRecord.expiry > new Date()) {
      try {
        const roomPubkey = new PublicKey(pubkeyStr);
        const onChainRoom: any = await (program.account as any).room.fetch(roomPubkey);
        const onChainStatus = Object.keys(onChainRoom.status ?? {})[0] ?? 'active';
        if (onChainStatus === 'settled' || onChainStatus === 'cancelled') {
          const winnerKey = Object.keys(onChainRoom.winner ?? {})[0];
          const winner = winnerKey === 'moon' ? 'moon' : winnerKey === 'jeet' ? 'jeet' : 'draw';
          const finalPrice = parseOptionalBigInt(onChainRoom.finalPrice);
          const twapFinalPrice = parseOptionalBigInt(onChainRoom.twapFinalPrice);
          const platformFee = parseOptionalBigInt(onChainRoom.platformFee);

          const updateData: any = {
            status: onChainStatus === 'cancelled' ? 'cancelled' : 'settled',
          };
          if (winner) updateData.winner = winner;
          if (finalPrice !== null) updateData.finalPrice = finalPrice;
          if (twapFinalPrice !== null) updateData.twapFinalPrice = twapFinalPrice;
          if (platformFee !== null) updateData.platformFee = platformFee;

          await prisma.room.update({
            where: { roomPubkey: pubkeyStr },
            data: updateData,
          }).catch(() => {});

          return { success: true, error: 'Room has already settled on-chain and database was synced' };
        }
      } catch (err: any) {
        logger.warn({ msg: 'Failed to reconcile on-chain room status during on-demand settlement', pubkeyStr, err: err?.message });
      }

      return { success: false, error: 'Room has not expired yet' };
    }

    if (roomRecord.status === 'settled') {
      return { success: true, error: 'Room is already settled' };
    }

    const keeper = loadKeeperKeypair();
    const txSig = await settleRoom(program, connection, keeper, roomRecord);
    return { success: true, txSig };
  } catch (err: any) {
    const errMsg = extractErrorMessage(err);
    logger.error({ msg: 'On-demand settlement error', pubkeyStr, err: errMsg });
    return { success: false, error: errMsg };
  }
}
