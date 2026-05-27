import express from 'express';
import { prisma } from '../../db';
import { prismaRead } from '../../db';
import { getLeaderboard } from '../../redis';
import { logger } from '../../logger';
import { validate, leaderboardQuerySchema } from '../validation';

export const leaderboardRouter = express.Router();

function scoreToElo(score: string): number {
  switch (score.trim()) {
    case 'S': return 1800;
    case 'A': return 1600;
    case 'B': return 1400;
    case 'C': return 1200;
    case 'D': return 1000;
    default: return 1200;
  }
}

// ── GET /api/leaderboard ───────────────────────────────────────

leaderboardRouter.get('/', validate(leaderboardQuerySchema), async (req, res) => {
  try {
    const { limit, sortBy } = req.query as unknown as {
      limit: number;
      sortBy: string;
    };

    if (sortBy === 'profit') {
      // Fast path: Redis sorted set
      const cached = await getLeaderboard(limit);
      if (cached.length > 0) {
        // Hydrate from database in bulk to get wins, losses, trenchScore, etc.
        const pubkeys = cached.map((c) => c.user);
        const profiles = await prismaRead.userProfile.findMany({
          where: { userPubkey: { in: pubkeys } },
        });

        const profileMap = new Map(profiles.map((p) => [p.userPubkey, p]));

        const data = await Promise.all(
          cached.map(async (c, idx) => {
            const u = profileMap.get(c.user);
            if (!u) {
              return {
                rank: idx + 1,
                userPubkey: c.user,
                totalBets: 0,
                wins: 0,
                losses: 0,
                profit: c.profit,
                trenchScore: 'D',
                elo: 1000,
                winRate: 0,
                alignment: 'moon',
              };
            }

            const bets = await prismaRead.bet.findMany({
              where: { userPubkey: u.userPubkey },
              select: { side: true },
            });
            const moonCount = bets.filter((b) => b.side === 'moon').length;
            const jeetCount = bets.filter((b) => b.side === 'jeet').length;
            const alignment = moonCount >= jeetCount ? 'moon' : 'jeet';

            return {
              rank: idx + 1,
              userPubkey: u.userPubkey,
              totalBets: u.totalBets,
              wins: u.wins,
              losses: u.losses,
              profit: c.profit,
              trenchScore: u.trenchScore,
              elo: scoreToElo(u.trenchScore),
              winRate: u.totalBets > 0 ? Math.round((u.wins / u.totalBets) * 100) : 0,
              alignment,
            };
          })
        );

        return res.json({ success: true, source: 'cache_hydrated', data });
      }
    }

    // Fallback / non-profit sorts: read from replica
    let orderBy: any;
    switch (sortBy) {
      case 'wins':
        orderBy = { wins: 'desc' };
        break;
      case 'winRate':
        orderBy = { wins: 'desc' };
        break;
      case 'trenchScore':
        orderBy = { trenchScore: 'asc' };
        break;
      default:
        orderBy = { profit: 'desc' };
    }

    const users = await prismaRead.userProfile.findMany({
      orderBy,
      take: limit,
      where:
        sortBy === 'winRate'
          ? { totalBets: { gte: 5 } }
          : undefined,
    });

    const data = await Promise.all(
      users.map(async (u, idx) => {
        const bets = await prismaRead.bet.findMany({
          where: { userPubkey: u.userPubkey },
          select: { side: true },
        });
        const moonCount = bets.filter((b) => b.side === 'moon').length;
        const jeetCount = bets.filter((b) => b.side === 'jeet').length;
        const alignment = moonCount >= jeetCount ? 'moon' : 'jeet';

        return {
          rank: idx + 1,
          userPubkey: u.userPubkey,
          totalBets: u.totalBets,
          wins: u.wins,
          losses: u.losses,
          profit: u.profit.toString(),
          trenchScore: u.trenchScore,
          elo: scoreToElo(u.trenchScore),
          winRate: u.totalBets > 0 ? Math.round((u.wins / u.totalBets) * 100) : 0,
          alignment,
        };
      })
    );

    return res.json({ success: true, source: 'replica', data });
  } catch (err: any) {
    logger.error({ msg: 'GET /api/leaderboard error', err: err?.message });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
