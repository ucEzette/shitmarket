// ── Proof-of-Reserves Endpoint (Phase 4.4) ─────────────────────
// On-chain SOL balance verification against platform state.
// Exposes a /api/reserves endpoint that reports:
//   - Total SOL locked in on-chain escrow PDAs
//   - Total tracked liabilities (unclaimed bets + pending payouts)
//   - Solvency ratio (assets / liabilities)
//   - Individual PDA balances for audit trail

import express from 'express';
import { Connection, PublicKey } from '@solana/web3.js';
import { prisma, prismaRead } from '../../db';
import { logger } from '../../logger';
import { config } from '../../config';

export const reservesRouter = express.Router();

// ── Platform Configuration ─────────────────────────────────────
// These PDAs should match what's in the Anchor program.
// In production, derive these dynamically from the program ID.
const PLATFORM_CONFIG_SEED = 'platform_config';
const ESCROW_SEED = 'escrow';
const PROGRAM_ID = new PublicKey(config.solana.programId);

function derivePda(seeds: Buffer[]): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(seeds, PROGRAM_ID);
  return pda;
}

interface EscrowAccount {
  pubkey: string;
  label: string;
  balanceLamports: number;
  balanceSol: number;
}

interface ReservesReport {
  timestamp: string;
  assets: {
    totalLamports: number;
    totalSol: number;
    escrowAccounts: EscrowAccount[];
    platformConfigBalanceSol: number;
  };
  liabilities: {
    totalUnclaimedBetsLamports: number;
    totalUnclaimedBetsSol: number;
    totalPendingPayoutsLamports: number;
    totalPendingPayoutsSol: number;
    totalLiabilitiesLamports: number;
    totalLiabilitiesSol: number;
    breakdown: {
      activeRooms: number;
      unclaimedBets: number;
      pendingPayouts: number;
    };
  };
  solvency: {
    ratio: number;
    status: 'solvent' | 'insolvent' | 'unknown';
    surplusLamports: number;
    surplusSol: number;
  };
  source: 'onchain' | 'cached' | 'error';
}

// ── GET /api/reserves ──────────────────────────────────────────
// Returns a proof-of-reserves report showing platform solvency.

reservesRouter.get('/', async (_req, res) => {
  try {
    const connection = new Connection(config.solana.rpcUrl, 'confirmed');

    // ── 1. Fetch on-chain escrow balances ───────────────────────
    // Derive the escrow PDAs for each active room.
    // In production, we'd iterate all Room PDAs from the program.
    // For now, fetch from DB and derive on-chain addresses.

    const activeRooms = await prismaRead.room.findMany({
      where: { status: 'active' },
      select: { id: true, roomPubkey: true },
    });

    const settledRooms = await prismaRead.room.findMany({
      where: { status: 'settled' },
      select: { id: true, roomPubkey: true },
    });

    const allRoomPubkeys = [...activeRooms, ...settledRooms].map((r) => r.roomPubkey);

    // Build escrow PDA list
    const escrowAccounts: EscrowAccount[] = [];
    let totalOnChainLamports = 0n;

    for (const roomPubkey of allRoomPubkeys) {
      try {
        const roomPk = new PublicKey(roomPubkey);
        const [escrowPda] = PublicKey.findProgramAddressSync(
          [Buffer.from(ESCROW_SEED), roomPk.toBuffer()],
          PROGRAM_ID
        );

        const accountInfo = await connection.getAccountInfo(escrowPda);
        const balance = BigInt(accountInfo?.lamports ?? 0);

        if (balance > 0n) {
          escrowAccounts.push({
            pubkey: escrowPda.toBase58(),
            label: `Room Escrow: ${roomPubkey.slice(0, 8)}...`,
            balanceLamports: Number(balance),
            balanceSol: Number(balance) / 1e9,
          });
          totalOnChainLamports += balance;
        }
      } catch (err) {
        logger.warn({ msg: 'Failed to fetch escrow balance', roomPubkey, err });
      }
    }

    // Platform config PDA balance (treasury)
    let platformConfigBalance = 0n;
    try {
      const [configPda] = PublicKey.findProgramAddressSync(
        [Buffer.from(PLATFORM_CONFIG_SEED)],
        PROGRAM_ID
      );
      const configAccount = await connection.getAccountInfo(configPda);
      platformConfigBalance = BigInt(configAccount?.lamports ?? 0);
      if (platformConfigBalance > 0n) {
        escrowAccounts.push({
          pubkey: configPda.toBase58(),
          label: 'Platform Config (Treasury)',
          balanceLamports: Number(platformConfigBalance),
          balanceSol: Number(platformConfigBalance) / 1e9,
        });
        totalOnChainLamports += platformConfigBalance;
      }
    } catch (err) {
      logger.warn({ msg: 'Failed to fetch platform config balance', err });
    }

    const totalAssetsLamports = Number(totalOnChainLamports);
    const totalAssetsSol = totalAssetsLamports / 1e9;

    // ── 2. Calculate liabilities (from DB) ──────────────────────
    // Unclaimed bets: all active room bets that haven't been claimed
    const activeBetsData = await prismaRead.bet.findMany({
      where: {
        claimed: false,
        room: { status: 'settled' },
      },
      select: { amount: true },
    });

    const totalUnclaimedLamports = activeBetsData.reduce(
      (sum, b) => sum + BigInt(b.amount.toString()),
      0n
    );

    // Pending payouts that haven't been claimed
    const pendingPayouts = await prismaRead.payout.findMany({
      where: { claimedAt: null },
      select: { amount: true },
    });

    const totalPendingLamports = pendingPayouts.reduce(
      (sum, p) => sum + BigInt(p.amount.toString()),
      0n
    );

    // Active room bets (locked in rooms that haven't settled yet)
    const activeRoomBets = await prismaRead.bet.findMany({
      where: {
        claimed: false,
        room: { status: 'active' },
      },
      select: { amount: true },
    });

    const totalActiveLockedLamports = activeRoomBets.reduce(
      (sum, b) => sum + BigInt(b.amount.toString()),
      0n
    );

    const totalLiabilitiesLamports = Number(
      totalUnclaimedLamports + totalPendingLamports + totalActiveLockedLamports
    );
    const totalLiabilitiesSol = totalLiabilitiesLamports / 1e9;

    // ── 3. Solvency Calculation ─────────────────────────────────
    const solvencyRatio =
      totalLiabilitiesLamports > 0
        ? Math.round((totalAssetsLamports / totalLiabilitiesLamports) * 10000) / 10000
        : totalAssetsLamports > 0
          ? 999.99 // No liabilities, solvent
          : 0;

    const surplusLamports = totalAssetsLamports - totalLiabilitiesLamports;
    const surplusSol = surplusLamports / 1e9;

    let solvencyStatus: 'solvent' | 'insolvent' | 'unknown' = 'unknown';
    if (totalLiabilitiesLamports === 0 && totalAssetsLamports === 0) {
      solvencyStatus = 'unknown';
    } else if (solvencyRatio >= 1.0) {
      solvencyStatus = 'solvent';
    } else {
      solvencyStatus = 'insolvent';
    }

    const report: ReservesReport = {
      timestamp: new Date().toISOString(),
      assets: {
        totalLamports: totalAssetsLamports,
        totalSol: totalAssetsSol,
        escrowAccounts,
        platformConfigBalanceSol: Number(platformConfigBalance) / 1e9,
      },
      liabilities: {
        totalUnclaimedBetsLamports: Number(totalUnclaimedLamports),
        totalUnclaimedBetsSol: Number(totalUnclaimedLamports) / 1e9,
        totalPendingPayoutsLamports: Number(totalPendingLamports),
        totalPendingPayoutsSol: Number(totalPendingLamports) / 1e9,
        totalLiabilitiesLamports,
        totalLiabilitiesSol,
        breakdown: {
          activeRooms: activeRooms.length,
          unclaimedBets: activeBetsData.length,
          pendingPayouts: pendingPayouts.length,
        },
      },
      solvency: {
        ratio: solvencyRatio,
        status: solvencyStatus,
        surplusLamports,
        surplusSol,
      },
      source: totalAssetsLamports > 0 ? 'onchain' : 'cached',
    };

    logger.info({
      msg: 'Proof-of-reserves report generated',
      totalAssets: totalAssetsSol.toFixed(4),
      totalLiabilities: totalLiabilitiesSol.toFixed(4),
      solvencyRatio: solvencyRatio.toFixed(4),
      status: solvencyStatus,
    });

    return res.json({ success: true, data: report });
  } catch (err: any) {
    logger.error({ msg: 'GET /api/reserves error', err: err?.message });

    // Return a best-effort report instead of failing
    return res.status(500).json({
      success: false,
      error: 'Failed to generate proof-of-reserves report',
      data: {
        timestamp: new Date().toISOString(),
        assets: { totalLamports: 0, totalSol: 0, escrowAccounts: [], platformConfigBalanceSol: 0 },
        liabilities: {
          totalUnclaimedBetsLamports: 0,
          totalUnclaimedBetsSol: 0,
          totalPendingPayoutsLamports: 0,
          totalPendingPayoutsSol: 0,
          totalLiabilitiesLamports: 0,
          totalLiabilitiesSol: 0,
          breakdown: { activeRooms: 0, unclaimedBets: 0, pendingPayouts: 0 },
        },
        solvency: { ratio: 0, status: 'unknown' as const, surplusLamports: 0, surplusSol: 0 },
        source: 'error' as const,
      },
    });
  }
});

// ── GET /api/reserves/summary ──────────────────────────────────
// Lightweight solvency check (faster, no on-chain queries)

reservesRouter.get('/summary', async (_req, res) => {
  try {
    // Just return the stored aggregate values from Redis/DB
    // without hitting the chain each time
    const activeRooms = await prismaRead.room.count({ where: { status: 'active' } });
    const settledUnclaimed = await prismaRead.bet.count({
      where: { claimed: false, room: { status: 'settled' } },
    });
    const pendingPayouts = await prismaRead.payout.count({ where: { claimedAt: null } });

    return res.json({
      success: true,
      data: {
        activeRooms,
        settledUnclaimedBets: settledUnclaimed,
        pendingPayouts,
        note: 'Full on-chain verification available at GET /api/reserves',
      },
    });
  } catch (err: any) {
    logger.error({ msg: 'GET /api/reserves/summary error', err: err?.message });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
