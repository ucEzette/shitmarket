import express from 'express';
import { prisma, prismaRead } from '../../db';
import { logger } from '../../logger';
import { validate, walletParamSchema } from '../validation';

export const profileRouter = express.Router();

// ── GET /api/profile/:wallet ───────────────────────────────────────────────────

profileRouter.get('/:wallet', validate(walletParamSchema, 'params'), async (req, res) => {
  try {
    const { wallet } = req.params;

    const profile = await prisma.userProfile.findUnique({
      where: { userPubkey: wallet },
    });

    if (!profile) {
      // Return empty profile for unknown wallets (not an error)
      return res.json({
        success: true,
        data: {
          userPubkey: wallet,
          totalBets: 0,
          wins: 0,
          losses: 0,
          profit: '0',
          trenchScore: 'D',
          achievements: [],
          winRate: 0,
        },
      });
    }

    // Compute win rate
    const winRate =
      profile.totalBets > 0
        ? Math.round((profile.wins / profile.totalBets) * 100)
        : 0;

    // Fetch recent bet history
    const bets = await prisma.bet.findMany({
      where: { userPubkey: wallet },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        room: {
          select: {
            tokenName: true,
            tokenSymbol: true,
            tokenImageUrl: true,
            status: true,
            winner: true,
          },
        },
      },
    });

    return res.json({
      success: true,
      data: {
        ...profile,
        profit: profile.profit.toString(),
        winRate,
        bets: bets.map((b) => ({
          ...b,
          amount: b.amount.toString(),
          won: b.room.status === 'settled' && b.side === b.room.winner,
        })),
      },
    });
  } catch (err: any) {
    logger.error({ msg: 'GET /api/profile/:wallet error', err: err?.message });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
