/**
 * Queue Utilities
 * BullMQ queue configuration and helpers
 */

import { Queue } from 'bullmq';
import Redis from 'ioredis';

let redisConnection: Redis | undefined;
let processingQueue: Queue | undefined;

/**
 * Get Redis connection
 */
export function getRedisConnection(): Redis {
  if (!redisConnection) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    redisConnection = new Redis(redisUrl);
  }
  return redisConnection;
}

/**
 * Get processing queue instance
 */
export function getProcessingQueue(): Queue {
  if (!processingQueue) {
    processingQueue = new Queue('processing', {
      connection: getRedisConnection(),
    });
  }
  return processingQueue;
}

/**
 * Enqueue processing job for meeting
 */
export async function enqueueProcessingJob(meetingId: string): Promise<void> {
  const queue = getProcessingQueue();
  await queue.add('process-meeting', { meetingId }, {
    jobId: `process-meeting-${meetingId}`, // Idempotency key
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  });
}

