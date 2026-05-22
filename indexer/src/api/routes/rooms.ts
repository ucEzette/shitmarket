import express from 'express';
import { prisma, prismaRead } from '../../db';
import { getCachedRoom } from '../../redis';
import { logger } from '../../logger';
import { validate, roomsQuerySchema, roomPubkeyParamSchema } from '../validation';

export const roomsRouter = express.Router();

// ── GET /api/rooms ─────────────────────────────────────────────────────────────

roomsRouter.get('/', validate(roomsQuerySchema), async (req, res) => {
  try {
    const { filter, status, limit } = req.query as unknown as {
      filter: string;
      status: string;
      limit: number;
    };

    let orderBy: any = {};
    if (filter === 'ending') {
      orderBy = { expiry: 'asc' };
    } else if (filter === 'biggest') {
      orderBy = { totalPool: 'desc' };
    } else {
      orderBy = { createdAt: 'desc' };
    }

    // Handle 'all' status – don't filter by status
    const whereClause = status === 'all' ? {} : { status };

    const rooms = await prismaRead.room.findMany({
      where: whereClause,
      orderBy,
      take: limit,
      select: {
        roomPubkey: true,
        tokenMint: true,
        priceFeed: true,
        tokenName: true,
        tokenSymbol: true,
        tokenImageUrl: true,
        duration: true,
        openingPrice: true,
        expiry: true,
        status: true,
        winner: true,
        totalPool: true,
        createdAt: true,
        chainId: true,
        originalAddress: true,
      },
    });

    // Overlay live pool data from Redis where available
    const enriched = await Promise.all(
      rooms.map(async (room) => {
        const cached = await getCachedRoom(room.roomPubkey);
        return {
          ...room,
          openingPrice: room.openingPrice.toString(),
          totalPool: room.totalPool.toString(),
          priceFeed: room.priceFeed,
          moonPool: cached?.moonPool ?? null,
          jeetPool: cached?.jeetPool ?? null,
        };
      })
    );

    return res.json({ success: true, data: enriched });
  } catch (err: any) {
    logger.error({ msg: 'GET /api/rooms error', err: err?.message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ── GET /api/rooms/:pubkey ─────────────────────────────────────────────────────

roomsRouter.get('/:pubkey', validate(roomPubkeyParamSchema, 'params'), async (req, res) => {
  try {
    const { pubkey } = req.params;

    const room = await prismaRead.room.findUnique({
      where: { roomPubkey: pubkey },
      include: {
        bets: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    // Enrich with Redis live data
    const cached = await getCachedRoom(pubkey);

    const payouts = await prismaRead.payout.findMany({
      where: { roomPubkey: pubkey },
    });

    return res.json({
      success: true,
      data: {
        ...room,
        openingPrice: room.openingPrice.toString(),
        finalPrice: room.finalPrice?.toString() ?? null,
        totalPool: room.totalPool.toString(),
        platformFee: room.platformFee.toString(),
        moonPool: cached?.moonPool ?? '0',
        jeetPool: cached?.jeetPool ?? '0',
        bets: room.bets.map((b) => ({
          ...b,
          amount: b.amount.toString(),
        })),
        payouts: payouts.map((p) => ({
          ...p,
          amount: p.amount.toString(),
        })),
      },
    });
  } catch (err: any) {
    logger.error({ msg: 'GET /api/rooms/:pubkey error', err: err?.message });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ── GET /api/rooms/config/pyth-feeds ──────────────────────────────────────────

roomsRouter.get('/config/pyth-feeds', (_req, res) => {
  const pythFeedMap = require('../../feeds/pythFeedMap.json');
  res.json({ success: true, data: pythFeedMap });
});
