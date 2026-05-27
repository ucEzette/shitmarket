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

let activeConnection: Connection | null = null;
let activeProgram: anchor.Program | null = null;

function loadKeeperKeypair(): Keypair {
  const raw = config.solana.keeperPrivateKey;
  try {
    // Support both JSON array format and base58 format
    if (raw.startsWith('[')) {
      const arr: number[] = JSON.parse(raw);
      return Keypair.fromSecretKey(Uint8Array.from(arr));
    }
    return Keypair.fromSecretKey(bs58.decode(raw));
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

function deriveConfigPda(programId: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('platform_config')],
    programId
  );
  return pda;
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

    // Fetch config to get treasury pubkey
    let treasury: PublicKey;
    try {
      const configAccount = await (program.account as any).platformConfig.fetch(configPda);
      treasury = configAccount.treasury;
    } catch (err: any) {
      logger.error({ msg: 'Failed to fetch platform config', err: err?.message });
      await release();
      throw err;
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

    let result = await aggregatePrice(roomRecord.tokenMint, pythFeedId, historicalSamples);
    if (!result) {
      if (process.env.NODE_ENV === 'development') {
        logger.info({
          msg: 'Price aggregation failed in development mode. Falling back to mockAggregatePrice.',
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

    let twapValue: number | null = null;
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

    logger.info({
      msg: 'Submitting settle_room',
      room: roomPubkeyStr,
      priceFeed: pythFeedId,
      switchboardFeed: switchboardFeedStr || 'none',
      sources: result.sources,
      priceI64: result.priceI64,
      twapPrice: twapValue !== null ? twapValue : result.twapPrice,
    });

    try {
      // Phase 3.1: Build account meta including optional switchboard feed
      const accounts: Record<string, PublicKey> = {
        room: roomPubkey,
        escrow: escrowPda,
        treasury,
        priceFeed: new PublicKey(pythFeedId),
        switchboardFeed: switchboardFeedStr
          ? new PublicKey(switchboardFeedStr)
          : PublicKey.default, // Pubkey::default() means not used
        config: configPda,
        keeper: keeper.publicKey,
        systemProgram: SystemProgram.programId,
      };

      let finalPriceParam: anchor.BN;
      if (twapValue !== null) {
        const scaledPrice = Math.round(twapValue * 100_000_000);
        finalPriceParam = new anchor.BN(scaledPrice);
        logger.info({
          msg: 'Using Pyth TWAP price for settlement',
          room: roomPubkeyStr,
          twapPrice: twapValue,
          scaledPrice,
        });
      } else {
        const scaledPrice = result.priceI64 * 100;
        finalPriceParam = new anchor.BN(scaledPrice);
      }

      const tx = await program.methods
        .settleRoom(finalPriceParam)
        .accounts(accounts)
        .transaction();

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
      const msg = err?.message ?? String(err);
      // Gracefully handle already-settled rooms (race condition with another keeper)
      if (msg.includes('RoomAlreadySettled') || msg.includes('6002')) {
        logger.info({ msg: 'Room already settled by another keeper', room: roomPubkeyStr });
        // Mark as settled in DB to prevent future attempts
        await prisma.room.update({
          where: { roomPubkey: roomPubkeyStr },
          data: { status: 'settled' },
        }).catch(() => {}); // Best-effort
        return 'already_settled';
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

  // Run every 3 seconds
  const task = cron.schedule('*/3 * * * * *', async () => {
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
    } catch (err: any) {
      logger.error({ msg: 'Keeper DB query failed', err: err?.message });
      return;
    }

    if (expiredRooms.length === 0) return;

    logger.info({ msg: 'Keeper found expired rooms', count: expiredRooms.length });

    // Settle concurrently but with a small cap
    await Promise.allSettled(
      expiredRooms.map((room) => settleRoom(program, connection, keeper, room))
    );
  });

  logger.info('Settlement keeper started — running every 3 seconds');
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

    if (roomRecord.status === 'settled') {
      return { success: true, error: 'Room is already settled' };
    }

    if (roomRecord.expiry > new Date()) {
      return { success: false, error: 'Room has not expired yet' };
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

    const keeper = loadKeeperKeypair();
    const txSig = await settleRoom(program, connection, keeper, roomRecord);
    return { success: true, txSig };
  } catch (err: any) {
    logger.error({ msg: 'On-demand settlement error', pubkeyStr, err: err?.message });
    return { success: false, error: err?.message || String(err) };
  }
}
