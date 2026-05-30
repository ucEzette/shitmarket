import express from 'express';
import { prisma, prismaRead } from '../../db';
import { getCachedRoom, cacheRoom, publishRoomUpdate } from '../../redis';
import { logger } from '../../logger';
import { validate, roomsQuerySchema, roomPubkeyParamSchema } from '../validation';
import { Connection, PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { config } from '../../config';
import { settleRoomByPubkey } from '../../keeper/settlementKeeper';

export const roomsRouter = express.Router();

// Helper to fetch token metadata from DexScreener
async function fetchTokenMeta(mintAddress: string): Promise<any> {
  try {
    const url = `${config.external.dexscreenerUrl}/tokens/${mintAddress}`;
    const response = await fetch(url);
    if (!response.ok) return {};
    const data: any = await response.json();
    const pairs: any[] = data?.pairs ?? [];
    if (!pairs.length) return {};
    const best = pairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
    return {
      name: best.baseToken?.name,
      symbol: best.baseToken?.symbol,
      imageUrl: best.info?.imageUrl ?? undefined,
      chainId: best.chainId ?? 'solana',
      originalAddress: mintAddress,
      pairAddress: best.pairAddress,
    };
  } catch {
    return {};
  }
}

// Self-healing sync room function
async function syncRoomFromChain(pubkeyStr: string): Promise<any> {
  try {
    logger.info({ msg: 'Triggering on-chain room fetch for sync', pubkeyStr });
    const connection = new Connection(config.solana.rpcUrl, 'confirmed');
    const programId = new PublicKey(config.solana.programId);
    
    // Load IDL
    let idl: any;
    try {
      idl = require('../../../../program/target/idl/shitmarket.json');
    } catch {
      try {
        idl = require('../../utils/idl.json');
      } catch {
        logger.error({ msg: 'Failed to load IDL for syncRoomFromChain' });
        return null;
      }
    }
    
    // Build dummy provider and program
    const wallet = new anchor.Wallet(anchor.web3.Keypair.generate());
    const provider = new anchor.AnchorProvider(connection, wallet, {
      commitment: 'confirmed',
    });
    
    const idlWithAddress = { ...idl, address: programId.toBase58() };
    
    // Normalization logic just like main index.ts
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
    
    const program = new anchor.Program(idlWithAddress as anchor.Idl, provider);
    const roomPubkey = new PublicKey(pubkeyStr);
    
    const roomData: any = await (program.account as any).room.fetch(roomPubkey);
    if (!roomData) {
      logger.warn({ msg: 'Failed to fetch room account from Solana chain', pubkeyStr });
      return null;
    }
    
    const tokenMintStr = roomData.tokenMint.toBase58();
    const priceFeedStr = roomData.priceFeed.toBase58();
    const duration = roomData.durationMinutes;
    const openingPrice = BigInt(roomData.openingPrice.toString());
    
    const nameBytes = roomData.tokenName as number[];
    const decodedName = Buffer.from(nameBytes).toString('utf8').replace(/\0/g, '').trim();
    
    const expiry = new Date(roomData.expiryTimestamp.toNumber() * 1000);
    
    // Parse status enum
    const statusStr = Object.keys(roomData.status)[0].toLowerCase(); // 'active', 'settled', or 'pending'
    const creatorStr = roomData.creator.toBase58();
    
    // Parse winner
    let winnerStr: string | null = null;
    if (roomData.winner) {
      winnerStr = Object.keys(roomData.winner)[0].toLowerCase(); // 'moon' or 'jeet'
    }
    
    const finalPrice = roomData.finalPrice ? BigInt(roomData.finalPrice.toString()) : BigInt(0);
    const twapFinalPrice = roomData.twapFinalPrice ? BigInt(roomData.twapFinalPrice.toString()) : BigInt(0);
    
    const meta = await fetchTokenMeta(tokenMintStr);
    
    const moonPool = roomData.moonPool.toString();
    const jeetPool = roomData.jeetPool.toString();
    const totalPool = BigInt(roomData.moonPool.toString()) + BigInt(roomData.jeetPool.toString());
    
    // Save to Prisma
    const createdRoom = await prisma.room.upsert({
      where: { roomPubkey: pubkeyStr },
      create: {
        roomPubkey: pubkeyStr,
        tokenMint: tokenMintStr,
        priceFeed: priceFeedStr,
        tokenName: meta.name ?? decodedName,
        tokenSymbol: meta.symbol,
        tokenImageUrl: meta.imageUrl,
        chainId: meta.chainId ?? 'solana',
        originalAddress: meta.originalAddress ?? tokenMintStr,
        duration,
        openingPrice,
        expiry,
        status: statusStr,
        creator: creatorStr,
        winner: winnerStr,
        finalPrice: statusStr === 'settled' ? finalPrice : null,
        twapFinalPrice: statusStr === 'settled' ? twapFinalPrice : null,
        totalPool,
      },
      update: {
        status: statusStr,
        creator: creatorStr,
        winner: winnerStr,
        finalPrice: statusStr === 'settled' ? finalPrice : null,
        twapFinalPrice: statusStr === 'settled' ? twapFinalPrice : null,
        totalPool,
      }
    });
    
    // Cache in Redis
    const redisCacheData: Record<string, string> = {
      status: statusStr,
      tokenMint: tokenMintStr,
      tokenName: meta.name ?? decodedName,
      tokenSymbol: meta.symbol ?? '',
      tokenImageUrl: meta.imageUrl ?? '',
      openingPrice: openingPrice.toString(),
      moonPool,
      jeetPool,
      expiry: expiry.toISOString(),
      finalPrice: finalPrice.toString(),
      twapFinalPrice: twapFinalPrice.toString(),
      pairAddress: meta.pairAddress ?? '',
    };
    if (winnerStr) {
      redisCacheData.winner = winnerStr;
    }
    await cacheRoom(pubkeyStr, redisCacheData);
    
    logger.info({ msg: 'On-chain room sync complete', pubkeyStr });
    return createdRoom;
  } catch (err: any) {
    logger.error({ msg: 'Error in syncRoomFromChain', pubkeyStr, err: err?.message });
    return null;
  }
}

// ── GET /api/rooms ─────────────────────────────────────────────────────────────

roomsRouter.get('/', validate(roomsQuerySchema), async (req, res) => {
  try {
    const { filter, status, limit, creator } = req.query as unknown as {
      filter: string;
      status: string;
      limit: number;
      creator?: string;
    };

    let orderBy: any = {};
    if (filter === 'ending') {
      orderBy = { expiry: 'asc' };
    } else if (filter === 'biggest') {
      orderBy = { totalPool: 'desc' };
    } else {
      orderBy = { createdAt: 'desc' };
    }

    // Handle 'all' status – only show active/settled public rooms
    const whereClause: any = status === 'all' 
      ? { status: { in: ['active', 'settled'] } } 
      : { status };

    if (creator) {
      whereClause.creator = creator;
    }

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
        creator: true,
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
          creator: room.creator,
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

    let room = await prismaRead.room.findUnique({
      where: { roomPubkey: pubkey },
      include: {
        bets: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!room) {
      logger.info({ msg: 'Room not found in DB. Attempting sync from chain...', pubkey });
      const synced = await syncRoomFromChain(pubkey);
      if (synced) {
        room = await prismaRead.room.findUnique({
          where: { roomPubkey: pubkey },
          include: {
            bets: {
              orderBy: { createdAt: 'desc' },
              take: 50,
            },
          },
        });
      }
    }

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
        twapFinalPrice: room.twapFinalPrice?.toString() ?? null,
        totalPool: room.totalPool.toString(),
        platformFee: room.platformFee.toString(),
        moonPool: cached?.moonPool ?? '0',
        jeetPool: cached?.jeetPool ?? '0',
        pairAddress: cached?.pairAddress || (await fetchTokenMeta(room.tokenMint)).pairAddress || '',
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

// ── POST /api/rooms/:pubkey/settle ──────────────────────────────────────────────

roomsRouter.post('/:pubkey/settle', validate(roomPubkeyParamSchema, 'params'), async (req, res) => {
  try {
    const { pubkey } = req.params;
    logger.info({ msg: 'On-demand settlement requested via API', pubkey });
    const result = await settleRoomByPubkey(pubkey);
    if (result.success) {
      return res.json({ success: true, txSig: result.txSig });
    } else {
      return res.status(400).json({ success: false, error: result.error });
    }
  } catch (err: any) {
    logger.error({ msg: 'POST /api/rooms/:pubkey/settle error', err: err?.message });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ── GET /api/rooms/:pubkey/chats ──────────────────────────────────────────────

roomsRouter.get('/:pubkey/chats', validate(roomPubkeyParamSchema, 'params'), async (req, res) => {
  try {
    const { pubkey } = req.params;
    const chats = await prisma.chatMessage.findMany({
      where: { roomPubkey: pubkey },
      orderBy: { timestamp: 'asc' },
      take: 100,
    });
    return res.json({
      success: true,
      data: chats.map((c) => ({
        roomId: c.roomPubkey,
        side: c.side,
        user: c.user,
        message: c.message,
        timestamp: c.timestamp.getTime(),
      })),
    });
  } catch (err: any) {
    logger.error({ msg: 'GET /api/rooms/:pubkey/chats error', err: err?.message });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ── POST /api/rooms/:pubkey/chats ─────────────────────────────────────────────

roomsRouter.post('/:pubkey/chats', validate(roomPubkeyParamSchema, 'params'), async (req, res) => {
  try {
    const { pubkey } = req.params;
    const { user, side, message } = req.body;

    if (!user || !side || !message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({ success: false, error: 'Missing or invalid chat properties' });
    }

    if (side !== 'moon' && side !== 'jeet' && side !== 'all') {
      return res.status(400).json({ success: false, error: 'Invalid chat channel side' });
    }

    // Verify room exists in database
    const roomExists = await prisma.room.findUnique({
      where: { roomPubkey: pubkey },
    });
    if (!roomExists) {
      return res.status(404).json({ success: false, error: 'Arena sector not found' });
    }

    // Save to Postgres / Supabase
    const saved = await prisma.chatMessage.create({
      data: {
        roomPubkey: pubkey,
        side,
        user,
        message: message.trim(),
      },
    });

    const chatData = {
      type: 'NewChatMessage',
      user: saved.user,
      side: saved.side,
      message: saved.message,
      timestamp: saved.timestamp.getTime(),
    };

    // Broadcast in real-time via Redis Pub/Sub → WebSocket Relay
    await publishRoomUpdate(pubkey, chatData);

    return res.json({ success: true, data: chatData });
  } catch (err: any) {
    logger.error({ msg: 'POST /api/rooms/:pubkey/chats error', err: err?.message });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
