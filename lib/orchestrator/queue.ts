/**
 * Orchestrator Queue Module
 * BullMQ queue configuration for processing meetings
 */

import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { ORCHESTRATOR_CONSTANTS, ORCHESTRATOR_ERROR_CODES } from './constants';
import { validateMeetingId } from '../meeting/validation';
import { prisma } from '../prisma';

let redisConnection: Redis | undefined;
let processingQueue: Queue | undefined;

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
 * Get processing queue instance
 */
export function getProcessingQueue(): Queue {
  if (!processingQueue) {
    processingQueue = new Queue(ORCHESTRATOR_CONSTANTS.QUEUE_NAME, {
      connection: getRedisConnection(),
    });
  }
  return processingQueue;
}

/**
 * Enqueue processing job for meeting
 */
export async function enqueueProcessingJob(meetingId: string): Promise<void> {
  // Validate meeting ID format
  const idValidation = validateMeetingId(meetingId);
  if (!idValidation.valid) {
    throw new Error(
      `Invalid meeting ID format: ${idValidation.error?.message || 'Unknown error'}`
    );
  }

  // Verify meeting exists before adding to queue
  // This prevents queueing jobs for non-existent meetings
  const meetingExists = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: { id: true },
  });

  if (!meetingExists) {
    throw new Error(
      `${ORCHESTRATOR_ERROR_CODES.MEETING_NOT_FOUND}: Cannot enqueue job for non-existent meeting ${meetingId}`
    );
  }

  const queue = getProcessingQueue();
  await queue.add(
    'process-meeting',
    { meetingId },
    {
      jobId: `process-meeting-${meetingId}`, // Idempotency key
      attempts: ORCHESTRATOR_CONSTANTS.JOB_ATTEMPTS,
      backoff: {
        type: 'exponential',
        delay: ORCHESTRATOR_CONSTANTS.JOB_BACKOFF_DELAY,
      },
    }
  );
}

/**
 * Enqueue processing job with delay (for auto-retry)
 */
export async function enqueueProcessingJobWithDelay(
  meetingId: string,
  delayMs: number
): Promise<void> {
  // Validate meeting ID format
  const idValidation = validateMeetingId(meetingId);
  if (!idValidation.valid) {
    throw new Error(
      `Invalid meeting ID format: ${idValidation.error?.message || 'Unknown error'}`
    );
  }

  // Verify meeting exists before adding to queue
  // This prevents queueing jobs for non-existent meetings
  const meetingExists = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: { id: true },
  });

  if (!meetingExists) {
    throw new Error(
      `${ORCHESTRATOR_ERROR_CODES.MEETING_NOT_FOUND}: Cannot enqueue job for non-existent meeting ${meetingId}`
    );
  }

  const queue = getProcessingQueue();
  await queue.add(
    'process-meeting',
    { meetingId },
    {
      jobId: `process-meeting-${meetingId}`, // Idempotency key
      delay: delayMs,
      attempts: ORCHESTRATOR_CONSTANTS.JOB_ATTEMPTS,
      backoff: {
        type: 'exponential',
        delay: ORCHESTRATOR_CONSTANTS.JOB_BACKOFF_DELAY,
      },
    }
  );
}

