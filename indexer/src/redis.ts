import Redis from 'ioredis';
import { config } from './config';
import { logger } from './logger';
import { prisma } from './db';

// Singleton pub/sub pair — one connection for commands, one for subscribe
export const redis = new Redis(config.redis.url, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true,
});

export const redisSub = new Redis(config.redis.url, {
  maxRetriesPerRequest: null, // retry forever for subscriber
  enableReadyCheck: true,
  lazyConnect: true,
});

redis.on('error', (err) => logger.error({ msg: 'Redis error', err }));
redis.on('connect', () => logger.info('Redis connected'));

redisSub.on('error', (err) => logger.error({ msg: 'Redis subscriber error', err }));
redisSub.on('connect', () => logger.info('Redis subscriber connected'));

export async function connectRedis(): Promise<void> {
  await Promise.all([redis.connect(), redisSub.connect()]);
}

export async function disconnectRedis(): Promise<void> {
  await Promise.all([redis.quit(), redisSub.quit()]);
}

// ─── Room cache helpers ───────────────────────────────────────────────────────

const ROOM_TTL_SECONDS = 60 * 60 * 24; // 24 hours

export async function cacheRoom(roomPubkey: string, data: Record<string, string>): Promise<void> {
  const key = `room:${roomPubkey}`;
  await redis.hset(key, data);
  await redis.expire(key, ROOM_TTL_SECONDS);
}

export async function getCachedRoom(roomPubkey: string): Promise<Record<string, string> | null> {
  const key = `room:${roomPubkey}`;
  const data = await redis.hgetall(key);
  return Object.keys(data).length > 0 ? data : null;
}

export async function getCachedRooms(roomPubkeys: string[]): Promise<(Record<string, string> | null)[]> {
  if (roomPubkeys.length === 0) return [];
  const pipeline = redis.pipeline();
  roomPubkeys.forEach(pubkey => {
    pipeline.hgetall(`room:${pubkey}`);
  });
  const results = await pipeline.exec();
  if (!results) return roomPubkeys.map(() => null);

  return results.map(([err, data]) => {
    if (err || !data || Object.keys(data as object).length === 0) return null;
    return data as Record<string, string>;
  });
}

export async function publishRoomUpdate(roomPubkey: string, payload: object): Promise<void> {
  await redis.publish('room_updates', JSON.stringify({ roomPubkey, ...payload }));
}

// ─── Idempotency: processed transaction signatures ────────────────────────────

const TX_PROCESSED_TTL = 60 * 60 * 48; // 48 hours
const localProcessedCache = new Set<string>();
const MAX_LOCAL_CACHE_SIZE = 10000;

export async function isAlreadyProcessed(signature: string): Promise<boolean> {
  if (localProcessedCache.has(signature)) return true;

  try {
    const exists = await redis.exists(`tx:${signature}`);
    if (exists === 1) {
      localProcessedCache.add(signature);
      if (localProcessedCache.size > MAX_LOCAL_CACHE_SIZE) {
        localProcessedCache.delete(localProcessedCache.values().next().value as string);
      }
      return true;
    }
  } catch (err: any) {
    logger.warn({ msg: 'Redis exists check failed, falling back to DB', err: err.message });
  }

  const record = await prisma.processedTx.findUnique({
    where: { signature },
  });
  if (record !== null) {
    localProcessedCache.add(signature);
    if (localProcessedCache.size > MAX_LOCAL_CACHE_SIZE) {
      localProcessedCache.delete(localProcessedCache.values().next().value as string);
    }
    return true;
  }
  return false;
}

export async function markProcessed(signature: string): Promise<void> {
  localProcessedCache.add(signature);
  if (localProcessedCache.size > MAX_LOCAL_CACHE_SIZE) {
    localProcessedCache.delete(localProcessedCache.values().next().value as string);
  }

  await Promise.all([
    redis.setex(`tx:${signature}`, TX_PROCESSED_TTL, '1').catch(err => logger.warn({ msg: 'Redis setex failed', err: err.message })),
    prisma.processedTx.create({ data: { signature } }).catch(() => undefined),
  ]);
}

// ─── Leaderboard sorted set ───────────────────────────────────────────────────

export async function updateLeaderboard(userPubkey: string, profit: bigint): Promise<void> {
  await redis.zadd('leaderboard:profit', Number(profit), userPubkey);
}

export async function getLeaderboard(limit = 50): Promise<{ user: string; profit: string }[]> {
  const entries = await redis.zrevrange('leaderboard:profit', 0, limit - 1, 'WITHSCORES');
  const result: { user: string; profit: string }[] = [];
  for (let i = 0; i < entries.length; i += 2) {
    result.push({ user: entries[i], profit: entries[i + 1] });
  }
  return result;
}
