/**
 * Orchestrator Workers
 * BullMQ workers for processing meetings
 */

import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { MeetingStatus } from '@prisma/client';
import { prisma } from '../prisma';
import { acquireLockWithRetries, releaseLock, extendLock } from './locks';
import { processTranscription } from './processors/transcription';
import { processLLM } from './processors/llm';
import { deleteUploadBlob } from './cleanup';
import { updateMeetingStatus } from '../meeting/service';
import { ORCHESTRATOR_CONSTANTS, ORCHESTRATOR_ERROR_CODES } from './constants';
import { scheduleAutoRetry } from './auto-retry-utils';
import { createModuleLogger } from '../logger';

const logger = createModuleLogger('Orchestrator:Worker');

let redisConnection: Redis | undefined;
let processingWorker: Worker | undefined;

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
 * Process meeting job
 */
async function processMeetingJob(job: Job<{ meetingId: string }>): Promise<void> {
  const { meetingId } = job.data;
  let lockKey: string | null = null;

  logger.info(`Starting job processing for meeting ${meetingId}`);

  try {
    // First, verify meeting exists before acquiring lock
    // This prevents LOCK_ACQUISITION_FAILED errors for non-existent meetings
    logger.debug(`Verifying meeting exists: ${meetingId}`);
    const meetingExists = await prisma.meeting.findUnique({
      where: { id: meetingId },
      select: { id: true },
    });

    if (!meetingExists) {
      logger.error(`Meeting not found: ${meetingId}`);
      throw new Error(ORCHESTRATOR_ERROR_CODES.MEETING_NOT_FOUND);
    }

    // Acquire lock for meeting processing
    logger.debug(`Acquiring lock for meeting ${meetingId}`);
    const lockResult = await acquireLockWithRetries(meetingId);
    if (!lockResult.acquired) {
      logger.error(`Failed to acquire lock for meeting ${meetingId}`);
      throw new Error(ORCHESTRATOR_ERROR_CODES.LOCK_ACQUISITION_FAILED);
    }
    lockKey = lockResult.lockKey;
    logger.debug(`Lock acquired for meeting ${meetingId}`);

    // Get meeting to check current status
    logger.debug(`Fetching meeting data for ${meetingId}`);
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      select: {
        id: true,
        status: true,
        transcript: { select: { id: true } },
        artifacts: { select: { id: true } },
      },
    });

    if (!meeting) {
      throw new Error(ORCHESTRATOR_ERROR_CODES.MEETING_NOT_FOUND);
    }

    // Process transcription if needed
    if (!meeting.transcript && (meeting.status === 'Uploaded' || meeting.status === 'Transcribing')) {
      // Extend lock periodically
      const lockExtender = setInterval(() => {
        if (lockKey) {
          extendLock(lockKey).catch(() => {
            // Ignore errors
          });
        }
      }, 60000); // Extend every minute

      try {
        logger.info(`Processing transcription for meeting ${meetingId}`);
        const transcriptionResult = await processTranscription(meetingId);
        if (!transcriptionResult.success) {
          logger.error(`Transcription failed for meeting ${meetingId}`, transcriptionResult.error, {
            code: transcriptionResult.error?.code,
            details: transcriptionResult.error?.details,
          });
          // Set TTL for UploadBlob on failure
          await deleteUploadBlob(meetingId, false);
          throw new Error(transcriptionResult.error?.message || 'Transcription failed');
        }
        logger.info(`Transcription completed successfully for meeting ${meetingId}`);
        
        // Re-fetch meeting to get updated status after transcription
        const updatedMeeting = await prisma.meeting.findUnique({
          where: { id: meetingId },
          select: {
            id: true,
            status: true,
            transcript: { select: { id: true } },
            artifacts: { select: { id: true } },
          },
        });
        if (updatedMeeting) {
          Object.assign(meeting, updatedMeeting);
        }
      } catch (transcriptionError: any) {
        logger.error(`Transcription error for meeting ${meetingId}`, transcriptionError);
        throw transcriptionError;
      } finally {
        clearInterval(lockExtender);
      }
    }

    // Process LLM if needed
    // Re-check meeting state to ensure we have latest status after transcription
    const currentMeeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      select: {
        id: true,
        status: true,
        transcript: { select: { id: true } },
        artifacts: { select: { id: true } },
      },
    });

    if (!currentMeeting) {
      throw new Error(ORCHESTRATOR_ERROR_CODES.MEETING_NOT_FOUND);
    }

    logger.debug(`Checking LLM processing for meeting ${meetingId}`, {
      status: currentMeeting.status,
      hasTranscript: !!currentMeeting.transcript,
      hasArtifacts: !!currentMeeting.artifacts,
    });

    // Process LLM if transcript exists but artifacts don't
    // Need to handle case where transcript exists but status is still Uploaded (from previous run)
    if (!currentMeeting.artifacts && currentMeeting.transcript) {
      // If status is Uploaded but transcript exists, we need to transition through Transcribing first
      // (cannot skip states per pipeline rules)
      if (currentMeeting.status === 'Uploaded') {
        logger.info(`Transcript exists but status is Uploaded, transitioning to Transcribing then LLM_Processing for meeting ${meetingId}`);
        
        // First transition to Transcribing (allowed from Uploaded)
        const transcribingUpdate = await updateMeetingStatus(meetingId, 'Transcribing');
        if ('error' in transcribingUpdate) {
          logger.error(`Failed to transition status to Transcribing`, transcribingUpdate.error, {
            code: transcribingUpdate.error.code,
          });
          throw new Error(transcribingUpdate.error.message || 'Failed to transition to Transcribing');
        }
        
        // Then immediately transition to LLM_Processing (allowed from Transcribing)
        const llmUpdate = await updateMeetingStatus(meetingId, 'LLM_Processing');
        if ('error' in llmUpdate) {
          logger.error(`Failed to transition status to LLM_Processing`, llmUpdate.error, {
            code: llmUpdate.error.code,
          });
          throw new Error(llmUpdate.error.message || 'Failed to transition to LLM_Processing');
        }
        
        // Re-fetch to get updated status
        const updatedMeeting = await prisma.meeting.findUnique({
          where: { id: meetingId },
          select: {
            id: true,
            status: true,
            transcript: { select: { id: true } },
            artifacts: { select: { id: true } },
          },
        });
        if (updatedMeeting) {
          Object.assign(currentMeeting, updatedMeeting);
        }
      }

      // If status is Transcribing but transcript exists, transition to LLM_Processing
      if (currentMeeting.status === 'Transcribing') {
        logger.info(`Transcript exists but status is Transcribing, transitioning to LLM_Processing for meeting ${meetingId}`);
        const llmUpdate = await updateMeetingStatus(meetingId, 'LLM_Processing');
        if ('error' in llmUpdate) {
          logger.error(`Failed to transition status to LLM_Processing`, llmUpdate.error, {
            code: llmUpdate.error.code,
          });
          throw new Error(llmUpdate.error.message || 'Failed to transition to LLM_Processing');
        }
        // Re-fetch to get updated status
        const updatedMeeting = await prisma.meeting.findUnique({
          where: { id: meetingId },
          select: {
            id: true,
            status: true,
            transcript: { select: { id: true } },
            artifacts: { select: { id: true } },
          },
        });
        if (updatedMeeting) {
          Object.assign(currentMeeting, updatedMeeting);
        }
      }

      // Process LLM if status is LLM_Processing
      if (currentMeeting.status === 'LLM_Processing') {
        logger.info(`Processing LLM for meeting ${meetingId}`);
        // Extend lock periodically
        const lockExtender = setInterval(() => {
          if (lockKey) {
            extendLock(lockKey).catch(() => {
              // Ignore errors
            });
          }
        }, 60000); // Extend every minute

        try {
          const llmResult = await processLLM(meetingId);
          if (!llmResult.success) {
            // Set TTL for UploadBlob on failure
            await deleteUploadBlob(meetingId, false);
            throw new Error(llmResult.error?.message || 'LLM processing failed');
          }
        } finally {
          clearInterval(lockExtender);
        }
      }
    }
  } catch (error) {
    // Handle different error types
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isMeetingNotFound = errorMessage === ORCHESTRATOR_ERROR_CODES.MEETING_NOT_FOUND;
    const isLockFailed = errorMessage === ORCHESTRATOR_ERROR_CODES.LOCK_ACQUISITION_FAILED;

    // For meeting not found errors, don't try to update status or cleanup
    if (isMeetingNotFound) {
      logger.error(`Meeting not found: ${meetingId}, skipping status update and cleanup`);
      throw error;
    }

    // Update status to Failed_System on unexpected errors
    try {
      const meeting = await prisma.meeting.findUnique({
        where: { id: meetingId },
        select: { status: true },
      });

      // Only update status if meeting exists and is not already in a failed state
      if (meeting && meeting.status !== 'Failed_Transcription' && meeting.status !== 'Failed_LLM') {
        // Save error before updating status
        const errorDetails = {
          originalError: error instanceof Error ? error.message : 'Unknown error',
          errorName: error instanceof Error ? error.name : 'Unknown',
          errorStack: error instanceof Error ? error.stack : 'No stack trace',
        };
        
        try {
          const { generateShortId } = await import('../db/id-generator');
          const errorId = await generateShortId('processing_error');
          await prisma.processingError.create({
            data: {
              id: errorId,
              meetingId,
              stage: 'system',
              errorCode: 'SYSTEM_ERROR',
              errorMessage: error instanceof Error ? error.message : 'Unknown system error',
              errorDetails,
            },
          });
        } catch (saveError) {
          // Log but don't throw - error saving should not block status update
          logger.error(`Failed to save processing error`, saveError);
        }
        
        await updateMeetingStatus(meetingId, 'Failed_System');
        
        // Schedule automatic retry if applicable
        await scheduleAutoRetry(meetingId).catch((retryError) => {
          logger.error(`Failed to schedule auto retry`, retryError);
        });
      }

      // Set TTL for UploadBlob on failure
      await deleteUploadBlob(meetingId, false);
    } catch (cleanupError) {
      // Ignore cleanup errors
      logger.error('Failed to cleanup on error', cleanupError);
    }

    throw error;
  } finally {
    // Always release lock
    if (lockKey) {
      await releaseLock(lockKey).catch(() => {
        // Ignore errors
      });
    }
  }
}

/**
 * Get processing worker instance
 */
export function getProcessingWorker(): Worker {
  if (!processingWorker) {
    processingWorker = new Worker(
      ORCHESTRATOR_CONSTANTS.QUEUE_NAME,
      async (job: Job<{ meetingId: string }>) => {
        await processMeetingJob(job);
      },
      {
        connection: getRedisConnection(),
        concurrency: 5, // Process up to 5 meetings concurrently
        removeOnComplete: {
          count: 100, // Keep last 100 completed jobs
        },
        removeOnFail: {
          count: 1000, // Keep last 1000 failed jobs
        },
      }
    );

    // Error handling
    processingWorker.on('failed', (job, err) => {
      logger.error(`Job ${job?.id} failed`, err);
    });

    processingWorker.on('completed', (job) => {
      logger.info(`Job ${job.id} completed successfully`);
    });
  }

  return processingWorker;
}

/**
 * Start processing worker
 */
export function startProcessingWorker(): Worker {
  return getProcessingWorker();
}

/**
 * Stop processing worker
 */
export async function stopProcessingWorker(): Promise<void> {
  if (processingWorker) {
    await processingWorker.close();
    processingWorker = undefined;
  }
}

