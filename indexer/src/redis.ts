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

export async function publishRoomUpdate(roomPubkey: string, payload: object): Promise<void> {
  await redis.publish('room_updates', JSON.stringify({ roomPubkey, ...payload }));
}

// ─── Idempotency: processed transaction signatures ────────────────────────────

const TX_PROCESSED_TTL = 60 * 60 * 48; // 48 hours

export async function isAlreadyProcessed(signature: string): Promise<boolean> {
  const exists = await redis.exists(`tx:${signature}`);
  if (exists === 1) return true;

  const record = await prisma.processedTx.findUnique({
    where: { signature },
  });
  return record !== null;
}

export async function markProcessed(signature: string): Promise<void> {
  await Promise.all([
    redis.setex(`tx:${signature}`, TX_PROCESSED_TTL, '1'),
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
