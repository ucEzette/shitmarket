import express from 'express';
import { prisma } from '../../db';
import { prismaRead } from '../../db';
import { getLeaderboard } from '../../redis';
import { logger } from '../../logger';
import { validate, leaderboardQuerySchema } from '../validation';

export const leaderboardRouter = express.Router();

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
        return res.json({ success: true, source: 'cache', data: cached });
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

    const data = users.map((u, idx) => ({
      rank: idx + 1,
      userPubkey: u.userPubkey,
      totalBets: u.totalBets,
      wins: u.wins,
      losses: u.losses,
      profit: u.profit.toString(),
      trenchScore: u.trenchScore,
      winRate:
        u.totalBets > 0 ? Math.round((u.wins / u.totalBets) * 100) : 0,
    }));

    return res.json({ success: true, source: 'replica', data });
  } catch (err: any) {
    logger.error({ msg: 'GET /api/leaderboard error', err: err?.message });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
