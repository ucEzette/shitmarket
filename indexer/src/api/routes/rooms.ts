import express from 'express';
import axios from 'axios';
import { prisma, prismaRead } from '../../db';
import { getCachedRoom, getCachedRooms, cacheRoom, publishRoomUpdate } from '../../redis';
import { redis } from '../../redis';
import { logger } from '../../logger';
import { validate, roomsQuerySchema, roomPubkeyParamSchema } from '../validation';
import { Connection, PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { config } from '../../config';
import { settleRoomByPubkey } from '../../keeper/settlementKeeper';
import { aggregatePrice, getLookupAddress } from '../../feeds/priceAggregator';

export const roomsRouter = express.Router();

const tokenMetaCache = new Map<string, any>();

// Helper to fetch token metadata from DexScreener
async function fetchTokenMeta(mintAddress: string): Promise<any> {
  if (tokenMetaCache.has(mintAddress)) {
    return tokenMetaCache.get(mintAddress);
  }

  try {
    const cached = await redis.get(`tokenmeta:${mintAddress}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      tokenMetaCache.set(mintAddress, parsed);
      return parsed;
    }
  } catch (err) {
    logger.warn({ msg: 'Failed to read tokenmeta from redis', err });
  }

  try {
    const lookupAddress = getLookupAddress(mintAddress);
    const isEvm = lookupAddress.startsWith('0x');

    const url = `${config.external.dexscreenerUrl}/tokens/${lookupAddress}`;
    const { data } = await axios.get(url, { timeout: 5000 });
    const pairs: any[] = data?.pairs ?? [];
    if (!pairs.length) return {};
    const best = pairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
    const meta = {
      name: best.baseToken?.name,
      symbol: best.baseToken?.symbol,
      imageUrl: best.info?.imageUrl ?? undefined,
      chainId: best.chainId ?? (isEvm ? 'avalanche' : 'solana'),
      originalAddress: lookupAddress,
      pairAddress: best.pairAddress,
    };
    if (meta.symbol) {
      tokenMetaCache.set(mintAddress, meta);
      await redis.set(`tokenmeta:${mintAddress}`, JSON.stringify(meta), 'EX', 86400).catch(() => {});
    }
    return meta;
  } catch (err: any) {
    logger.error({ msg: 'fetchTokenMeta failed in rooms route', mintAddress, err: err?.message });
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

    // Handle 'all' status – show active, settled, and disputed public rooms
    const whereClause: any = status === 'all' 
      ? { status: { in: ['active', 'settled', 'disputed'] } } 
      : { status };

    // Enforce that pending rooms can only be queried by their creator
    if (status === 'pending' && !creator) {
      return res.json({ success: true, data: [] });
    }

    if (creator) {
      whereClause.creator = creator;
    }

    let rooms: any[] | null = null;
    const cacheKey = `rooms:list:${status}:${filter}:${limit}:${creator || 'all'}`;
    
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        rooms = JSON.parse(cached);
      }
    } catch (err) {
      logger.warn({ msg: 'Failed to read rooms query cache from Redis', err });
    }

    if (!rooms) {
      const dbRooms = await prismaRead.room.findMany({
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
          oracleAddress: true,
          oracleFeeLamports: true,
          settledAt: true,
          disputeStatus: true,
          resolutionCriteria: true,
          disputedAt: true,
          disputeChallenger: true,
          disputeBond: true,
          oracleLogs: true,
        },
      });

      rooms = dbRooms.map(r => ({
        ...r,
        openingPrice: r.openingPrice.toString(),
        totalPool: r.totalPool.toString(),
        oracleFeeLamports: r.oracleFeeLamports ? r.oracleFeeLamports.toString() : null,
        disputeBond: r.disputeBond ? r.disputeBond.toString() : null,
      }));

      try {
        await redis.set(cacheKey, JSON.stringify(rooms), 'EX', 5); // 5 seconds cache TTL
      } catch (err) {
        logger.warn({ msg: 'Failed to write rooms query cache to Redis', err });
      }
    }

    // Overlay live pool data from Redis where available in a single pipelined call
    const cachedData = await getCachedRooms(rooms.map(r => r.roomPubkey));
    const enriched = rooms.map((room, idx) => {
      const cached = cachedData[idx];
      return {
        ...room,
        priceFeed: room.priceFeed,
        creator: room.creator,
        moonPool: cached?.moonPool ?? null,
        jeetPool: cached?.jeetPool ?? null,
      };
    });

    return res.json({ success: true, data: enriched });
  } catch (err: any) {
    logger.error({ msg: 'GET /api/rooms error', err: err?.message });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ── POST /api/rooms ────────────────────────────────────────────────────────────

roomsRouter.post('/', async (req, res) => {
  try {
    const {
      roomPubkey,
      tokenMint,
      tokenName,
      tokenSymbol,
      tokenImageUrl,
      category,
      resolutionCriteria,
      oracleAddress,
      oracleFeeLamports,
      moonPool,
      jeetPool,
      openingPrice,
      expiry,
      creator,
      chainId,
      duration,
      status
    } = req.body;

    if (!roomPubkey) {
      return res.status(400).json({ success: false, error: 'Missing roomPubkey' });
    }

    const expiryDate = expiry ? new Date(expiry) : new Date(Date.now() + (duration || 60) * 60 * 1000);
    const openingPriceBigInt = openingPrice ? BigInt(Math.round(Number(openingPrice) * 1e12)) : BigInt(1e12);

    const normRoomPubkey = roomPubkey.startsWith('0x') ? roomPubkey.toLowerCase() : roomPubkey;
    const normTokenMint = tokenMint ? (tokenMint.startsWith('0x') ? tokenMint.toLowerCase() : tokenMint) : normRoomPubkey;
    const normCreator = creator ? (creator.startsWith('0x') ? creator.toLowerCase() : creator) : '';
    const normOracle = oracleAddress ? (oracleAddress.startsWith('0x') ? oracleAddress.toLowerCase() : oracleAddress) : '';

    const createdRoom = await prisma.room.upsert({
      where: { roomPubkey: normRoomPubkey },
      create: {
        roomPubkey: normRoomPubkey,
        tokenMint: normTokenMint,
        priceFeed: '0x0000000000000000000000000000000000000000000000000000000000000000',
        tokenName: tokenName || 'Custom Prediction',
        tokenSymbol: tokenSymbol || 'CUSTOM',
        tokenImageUrl: tokenImageUrl || '',
        chainId: chainId || (process.env.NEXT_PUBLIC_CORE_CHAIN || 'avalanche'),
        originalAddress: normTokenMint,
        duration: duration || 60,
        openingPrice: openingPriceBigInt,
        expiry: expiryDate,
        status: status || 'active',
        creator: normCreator,
        oracleAddress: normOracle,
        oracleFeeLamports: oracleFeeLamports ? BigInt(oracleFeeLamports) : BigInt(0),
        resolutionCriteria: resolutionCriteria || '',
        totalPool: BigInt(Math.round(((moonPool || 0) + (jeetPool || 0)) * 1e6)),
      },
      update: {
        status: status || 'active',
        tokenName: tokenName || undefined,
        tokenImageUrl: tokenImageUrl || undefined,
        resolutionCriteria: resolutionCriteria || undefined,
      }
    });

    // Cache in Redis
    await cacheRoom(normRoomPubkey, {
      status: status || 'active',
      tokenMint: normTokenMint,
      tokenName: tokenName || 'Custom Prediction',
      tokenSymbol: tokenSymbol || 'CUSTOM',
      tokenImageUrl: tokenImageUrl || '',
      openingPrice: openingPriceBigInt.toString(),
      moonPool: String(moonPool || 0),
      jeetPool: String(jeetPool || 0),
      expiry: expiryDate.toISOString(),
      pairAddress: '',
    });

    // Invalidate list query caches so new room appears immediately at top of GET /api/rooms
    try {
      const keys = await redis.keys('rooms:list:*');
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (cacheErr) {
      logger.warn({ msg: 'Failed to clear rooms query cache in Redis', cacheErr });
    }

    logger.info({ msg: 'Room created/upserted via API', roomPubkey: normRoomPubkey });
    return res.json({ success: true, data: createdRoom });
  } catch (err: any) {
    logger.error({ msg: 'POST /api/rooms error', err: err?.message });
    return res.status(500).json({ success: false, error: 'Failed to create room in indexer' });
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
        oracleFeeLamports: room.oracleFeeLamports ? room.oracleFeeLamports.toString() : null,
        disputeBond: room.disputeBond ? room.disputeBond.toString() : null,
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
    }

    const lowerError = (result.error ?? '').toLowerCase();
    if (lowerError.includes('already settled')) {
      return res.json({ success: true, txSig: result.txSig, info: result.error });
    }

    return res.status(400).json({ success: false, error: result.error });
  } catch (err: any) {
    logger.error({ msg: 'POST /api/rooms/:pubkey/settle error', err: err?.message });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ── GET /api/rooms/:pubkey/chats ──────────────────────────────────────────────

roomsRouter.get('/:pubkey/chats', validate(roomPubkeyParamSchema, 'params'), async (req, res) => {
  try {
    const { pubkey } = req.params;
    const chats = await prismaRead.chatMessage.findMany({
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

// ── GET /api/rooms/token-price/:mintAddress ──────────────────────────────────
roomsRouter.get('/token-price/:mintAddress', async (req, res) => {
  try {
    const { mintAddress } = req.params;
    const { pythFeedId } = req.query;
    
    // Compute aggregated price utilizing all connected oracles (DexScreener, Birdeye, Jupiter, Chainlink, Pyth)
    const result = await aggregatePrice(
      mintAddress, 
      pythFeedId as string | undefined
    );
    
    if (!result) {
      return res.status(404).json({ success: false, error: 'Failed to aggregate price for token' });
    }
    
    return res.json({
      success: true,
      priceUsd: parseFloat(result.priceUsd),
      priceI64: result.priceI64,
      sources: result.sources
    });
  } catch (err: any) {
    logger.error({ msg: 'GET /api/rooms/token-price error', err: err?.message });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
