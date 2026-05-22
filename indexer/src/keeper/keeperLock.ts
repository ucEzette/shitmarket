/**
 * keeperLock.ts
 *
 * Distributed lease lock for multi-keeper environments using Redis Redlock.
 *
 * Problem: Multiple keeper instances may race to settle the same expired room,
 * causing redundant on-chain transactions (wasted fees) and potential conflicts.
 *
 * Solution: Before attempting settlement, each keeper acquires a short-lived
 * Redis lock per room. Only the keeper holding the lock proceeds.
 *
 * Lock TTL should be longer than the expected settle_round-trip time
 * (typically 10–30s on Solana mainnet) but short enough that a crashed
 * keeper doesn't block settlement for long.
 */

import { redis } from '../redis';
import { logger } from '../logger';
import crypto from 'crypto';

const LOCK_TTL_SECONDS = 60; // 60 seconds — covers TX send + confirmation
const LOCK_RETRY_DELAY_MS = 500;
const LOCK_MAX_RETRIES = 5;

/**
 * Try to acquire a Redis-based distributed lock for a room.
 * Uses a random UUID as the lock value for safe release (only the
 * lock holder can release its own lock).
 *
 * Returns `true` if the lock was acquired. The caller MUST call
 * `releaseLock()` after settlement attempt (success or failure).
 */
export async function acquireRoomLock(roomPubkey: string): Promise<string | null> {
  const lockKey = `settle_lock:${roomPubkey}`;
  const lockValue = crypto.randomUUID();

  for (let attempt = 1; attempt <= LOCK_MAX_RETRIES; attempt++) {
    try {
      const acquired = await redis.set(lockKey, lockValue, 'EX', LOCK_TTL_SECONDS, 'NX');
      if (acquired === 'OK') {
        logger.debug({ msg: 'Keeper lock acquired', roomPubkey, lockValue });
        return lockValue;
      }
    } catch (err: any) {
      logger.warn({ msg: 'Keeper lock acquire error (will retry)', roomPubkey, err: err?.message });
    }

    // Lock held by another keeper — wait and retry
    if (attempt < LOCK_MAX_RETRIES) {
      await sleep(LOCK_RETRY_DELAY_MS * attempt);
    }
  }

  logger.debug({ msg: 'Keeper lock not acquired (another keeper is handling it)', roomPubkey });
  return null;
}

/**
 * Release a previously acquired lock.
 * Uses a Lua script to ensure we only delete our own lock (atomic compare-and-delete).
 */
export async function releaseLock(roomPubkey: string, lockValue: string): Promise<void> {
  const lockKey = `settle_lock:${roomPubkey}`;

  // Lua script: delete key only if value matches (prevents deleting another keeper's lock)
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;

  try {
    await redis.eval(script, 1, lockKey, lockValue);
    logger.debug({ msg: 'Keeper lock released', roomPubkey });
  } catch (err: any) {
    logger.error({ msg: 'Failed to release keeper lock', roomPubkey, err: err?.message });
  }
}

// ─── Helper ─────────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
