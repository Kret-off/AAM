/**
 * Orchestrator Module Locks
 * Redis-based locking for meeting processing
 */

import Redis from 'ioredis';
import { ORCHESTRATOR_CONSTANTS } from './constants';

let redisConnection: Redis | undefined;

/**
 * Get Redis connection
 */
function getRedisConnection(): Redis {
  if (!redisConnection) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    redisConnection = new Redis(redisUrl, {
      maxRetriesPerRequest: null, // Required for BullMQ
    });
  }
  return redisConnection;
}

/**
 * Acquire lock for meeting processing
 */
export async function acquireLock(meetingId: string): Promise<{ acquired: boolean; lockKey: string }> {
  const redis = getRedisConnection();
  const lockKey = `lock:meeting:${meetingId}`;
  const lockValue = `${Date.now()}`;
  const ttl = ORCHESTRATOR_CONSTANTS.LOCK_TTL_MS;

  // Try to acquire lock with SET NX EX
  const result = await redis.set(lockKey, lockValue, 'PX', ttl, 'NX');

  if (result === 'OK') {
    return { acquired: true, lockKey };
  }

  return { acquired: false, lockKey };
}

/**
 * Release lock
 */
export async function releaseLock(lockKey: string): Promise<void> {
  const redis = getRedisConnection();
  await redis.del(lockKey);
}

/**
 * Extend lock TTL
 */
export async function extendLock(lockKey: string): Promise<void> {
  const redis = getRedisConnection();
  await redis.pexpire(lockKey, ORCHESTRATOR_CONSTANTS.LOCK_TTL_MS);
}

/**
 * Acquire lock with retries
 */
export async function acquireLockWithRetries(
  meetingId: string
): Promise<{ acquired: boolean; lockKey: string }> {
  for (let attempt = 0; attempt < ORCHESTRATOR_CONSTANTS.MAX_LOCK_RETRIES; attempt++) {
    const result = await acquireLock(meetingId);
    if (result.acquired) {
      return result;
    }

    // Wait before retry
    if (attempt < ORCHESTRATOR_CONSTANTS.MAX_LOCK_RETRIES - 1) {
      await new Promise((resolve) =>
        setTimeout(resolve, ORCHESTRATOR_CONSTANTS.LOCK_RETRY_DELAY_MS)
      );
    }
  }

  return { acquired: false, lockKey: `lock:meeting:${meetingId}` };
}

