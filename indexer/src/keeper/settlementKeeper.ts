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
import { aggregatePrice } from '../feeds/priceAggregator';
import { updateEloAfterSettlement } from '../elo';
import {
  keeperSuccessTotal,
  keeperFailureTotal,
} from '../metrics/prometheus';
import { acquireRoomLock, releaseLock } from './keeperLock';

// ─── Keeper wallet ────────────────────────────────────────────────────────────

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
  }
): Promise<void> {
  const roomPubkeyStr = roomRecord.roomPubkey;
  const roomPubkey = new PublicKey(roomPubkeyStr);
  const programId = program.programId;

  // 1. Acquire distributed lock (prevents multi-keeper races)
  const lockValue = await acquireRoomLock(roomPubkeyStr);
  if (!lockValue) {
    // Another keeper is handling this room
    return;
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
      return;
    }

    // Resolve Pyth feed ID
    const pythFeedId =
      roomRecord.priceFeed ||
      (config.pythFeedMapping as Record<string, string>)[roomRecord.tokenMint];

    if (!pythFeedId) {
      logger.warn(`No Pyth feed found for room ${roomPubkeyStr}:${roomRecord.tokenMint}`);
      keeperFailureTotal.inc();
      await release();
      return;
    }

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

    const result = await aggregatePrice(roomRecord.tokenMint, pythFeedId, historicalSamples);
    if (!result) {
      logger.error({ msg: 'Price aggregation failed — skipping room', room: roomPubkeyStr });
      keeperFailureTotal.inc();
      await release();
      return;
    }

    logger.info({
      msg: 'Submitting settle_room',
      room: roomPubkeyStr,
      priceFeed: pythFeedId,
      switchboardFeed: switchboardFeedStr || 'none',
      sources: result.sources,
      priceI64: result.priceI64,
      twapPrice: result.twapPrice,
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

      const txSig = await program.methods
        .settleRoom()
        .accounts(accounts)
        .signers([keeper])
        .rpc({ commitment: 'confirmed', skipPreflight: false });

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
      } else {
        logger.error({ msg: 'settle_room failed', room: roomPubkeyStr, err: msg });
        keeperFailureTotal.inc();
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
