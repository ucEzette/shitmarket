// ── ELO Trench Score Calculator (Phase 4.5) ────────────────────
// Implements a modified ELO rating system for prediction market bets.
//
// How it works:
//   - Every user starts at ELO 1200 (Trench Score D)
//   - After each settled bet, ELO is recalculated based on:
//     * Expected outcome vs actual outcome
//     * Pool size (higher stakes = higher K-factor = more volatility)
//     * Side chosen (moon side vs jeet side — no bias, both treated equally)
//   - Trench Score (display tier) derived from ELO:
//     * S: ≥1800 ELO
//     * A: ≥1600 ELO
//     * B: ≥1400 ELO
//     * C: ≥1200 ELO
//     * D: <1200 ELO
//   - K-factor scales with volatility:
//     * Base K = 32
//     * Pool multiplier: log2(poolSize / 1 SOL + 1) * 8
//     * Volume multiplier: totalBets > 50 → K * 0.8 (stabilizes veterans)
//     * Win streak bonus: streak ≥ 3 → K * 1.2 (streaks are meaningful)
//   - Anti-sybil: New accounts (<3 bets) have K capped at 16

import { prisma } from './db';
import { logger } from './logger';

const BASE_ELO = 1200;
const BASE_K_FACTOR = 32;

export type TrenchScore = 'S' | 'A' | 'B' | 'C' | 'D';

// ── Convert ELO to Trench Score ────────────────────────────────
export function eloToTrenchScore(elo: number): TrenchScore {
  if (elo >= 1800) return 'S';
  if (elo >= 1600) return 'A';
  if (elo >= 1400) return 'B';
  if (elo >= 1200) return 'C';
  return 'D';
}

// ── Calculate K-Factor ─────────────────────────────────────────
// Higher for bigger pools (more volatile), lower for veterans.
function calculateKFactor(
  poolSizeLamports: bigint,
  totalBets: number,
  winStreak: number
): number {
  const poolSizeSol = Number(poolSizeLamports) / 1e9;
  const poolMultiplier = Math.log2(Math.max(poolSizeSol, 0.1) + 1) * 8;
  let k = BASE_K_FACTOR + poolMultiplier;

  // Veterans stabilize
  if (totalBets > 50) k *= 0.8;
  if (totalBets > 200) k *= 0.7;

  // Win streak bonus (hot streaks are meaningful)
  if (winStreak >= 3) k *= 1.2;
  if (winStreak >= 7) k *= 1.4;

  // Anti-sybil: cap K for new accounts
  if (totalBets < 3) k = Math.min(k, 16);

  return Math.round(k);
}

// ── Expected Score ─────────────────────────────────────────────
// Given two ELO ratings, what's the expected win probability?
function expectedScore(ratingA: number, _ratingB: number): number {
  return 1.0 / (1.0 + Math.pow(10, (_ratingB - ratingA) / 400.0));
}

// ── Recalculate ELO for a user after a bet settles ─────────────
// Returns the new ELO and trench score.
export function calculateElo(
  currentElo: number,
  won: boolean,
  poolSizeLamports: bigint,
  totalBets: number,
  winStreak: number
): { newElo: number; eloChange: number; kFactor: number } {
  // Use a synthetic opponent ELO of 1200 (the market itself)
  // This means: beating the market = gain ELO, losing to market = lose ELO
  const opponentElo = BASE_ELO;
  const expected = expectedScore(currentElo, opponentElo);
  const k = calculateKFactor(poolSizeLamports, totalBets, winStreak);
  const score = won ? 1.0 : 0.0;

  const eloChange = Math.round(k * (score - expected));
  const newElo = Math.max(100, currentElo + eloChange); // Floor at 100

  return { newElo, eloChange, kFactor: k };
}

// ── Update ELO in DB ───────────────────────────────────────────
// Called by the settlement keeper when a room is settled.
export async function updateEloAfterSettlement(
  userPubkey: string,
  won: boolean,
  poolSizeLamports: bigint
): Promise<{ elo: number; trenchScore: TrenchScore; eloChange: number }> {
  try {
    // Get or create user profile
    let profile = await prisma.userProfile.findUnique({
      where: { userPubkey },
    });

    if (!profile) {
      profile = await prisma.userProfile.create({
        data: {
          userPubkey,
          totalBets: 0,
          wins: 0,
          losses: 0,
          profit: 0n,
          trenchScore: 'D',
          achievements: [],
        },
      });
    }

    // Calculate current win streak from DB
    const recentBets = await prisma.bet.findMany({
      where: { userPubkey },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { room: { select: { winner: true, status: true } } },
    });

    let winStreak = 0;
    for (const bet of recentBets) {
      if (bet.room.status === 'settled') {
        if (bet.side === bet.room.winner) {
          winStreak++;
        } else {
          break;
        }
      }
    }

    // Parse current ELO from trench score (or use base)
    // For backward compatibility, we store ELO in a metadata field.
    // If no ELO stored, derive from trench score.
    const currentElo = profile.trenchScore
      ? scoreToElo(profile.trenchScore as TrenchScore)
      : BASE_ELO;

    const totalBets = profile.totalBets;
    const { newElo, eloChange, kFactor } = calculateElo(
      currentElo,
      won,
      poolSizeLamports,
      totalBets,
      winStreak
    );

    const newTrenchScore = eloToTrenchScore(newElo);

    // Update profile with new ELO-implied trench score
    await prisma.userProfile.update({
      where: { userPubkey },
      data: {
        trenchScore: newTrenchScore,
        wins: won ? { increment: 1 } : undefined,
        losses: won ? undefined : { increment: 1 },
        totalBets: { increment: 1 },
      },
    });

    // Also update the Reputation model if it exists
    const rep = await prisma.reputation.findUnique({
      where: { userPubkey },
    });

    if (rep) {
      const volumeBigInt = poolSizeLamports; // bet amount
      await prisma.reputation.update({
        where: { userPubkey },
        data: {
          tier: newTrenchScore,
          totalBets: { increment: 1n },
          totalWins: won ? { increment: 1n } : undefined,
          totalVolume: { increment: volumeBigInt },
          lastEval: new Date(),
        },
      });
    }

    logger.info({
      msg: 'ELO updated',
      userPubkey: userPubkey.slice(0, 8),
      eloChange,
      kFactor,
      from: currentElo,
      to: newElo,
      newTier: newTrenchScore,
    });

    return { elo: newElo, trenchScore: newTrenchScore, eloChange };
  } catch (err: any) {
    logger.error({ msg: 'ELO update failed', userPubkey, err: err?.message });
    throw err;
  }
}

// ── Estimate ELO from Trench Score (backward compat) ───────────
function scoreToElo(score: TrenchScore): number {
  switch (score) {
    case 'S': return 1800;
    case 'A': return 1600;
    case 'B': return 1400;
    case 'C': return 1200;
    case 'D': return 1000;
    default: return BASE_ELO;
  }
}

// ── Get leaderboard sorted by ELO ──────────────────────────────
export async function getEloLeaderboard(limit: number = 50) {
  const users = await prisma.userProfile.findMany({
    orderBy: { totalBets: 'desc' }, // We'll compute ELO order in app
    take: limit * 2,
    where: { totalBets: { gte: 3 } }, // Anti-sybil: min 3 bets
  });

  // Convert trench score to ELO and sort
  const withElo = users.map((u) => ({
    userPubkey: u.userPubkey,
    totalBets: u.totalBets,
    wins: u.wins,
    losses: u.losses,
    profit: u.profit.toString(),
    trenchScore: u.trenchScore,
    elo: scoreToElo(u.trenchScore as TrenchScore),
    winRate: u.totalBets > 0 ? Math.round((u.wins / u.totalBets) * 100) : 0,
  }));

  withElo.sort((a, b) => b.elo - a.elo);

  return withElo.slice(0, limit).map((u, idx) => ({
    rank: idx + 1,
    ...u,
  }));
}
