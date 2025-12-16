/**
 * Auto Retry Worker
 * Finds meetings that need automatic retry and processes them
 */

import { prisma } from '../prisma';
import { MeetingStatus } from '@prisma/client';
import { AUTO_RETRY_CONSTANTS } from './constants';
import { enqueueProcessingJob } from './queue';

/**
 * Schedule automatic retries for meetings that are ready
 * This function finds all meetings with Failed_* statuses that have
 * nextAutoRetryAt <= now() and autoRetryCount < MAX_AUTO_RETRIES
 */
export async function scheduleAutoRetries(): Promise<number> {
  const now = new Date();
  let processedCount = 0;

  try {
    // Find meetings that need retry
    const meetingsToRetry = await prisma.meeting.findMany({
      where: {
        status: {
          in: ['Failed_Transcription', 'Failed_LLM', 'Failed_System'],
        },
        nextAutoRetryAt: {
          lte: now,
        },
        autoRetryCount: {
          lt: AUTO_RETRY_CONSTANTS.MAX_AUTO_RETRIES,
        },
      },
      select: {
        id: true,
        status: true,
        autoRetryCount: true,
        uploadBlob: {
          select: {
            id: true,
            expiresAt: true,
            deletedAt: true,
          },
        },
        transcript: {
          select: {
            id: true,
          },
        },
      },
    });

    console.log(`[AutoRetry Worker] Found ${meetingsToRetry.length} meetings ready for retry`);

    for (const meeting of meetingsToRetry) {
      try {
        // Check if uploadBlob is still available
        if (!meeting.uploadBlob || meeting.uploadBlob.deletedAt) {
          console.log(
            `[AutoRetry Worker] Skipping meeting ${meeting.id}: UploadBlob deleted`
          );
          continue;
        }

        if (meeting.uploadBlob.expiresAt && new Date(meeting.uploadBlob.expiresAt) < now) {
          console.log(
            `[AutoRetry Worker] Skipping meeting ${meeting.id}: UploadBlob expired`
          );
          continue;
        }

        // Determine target status based on current status and available data
        let targetStatus: MeetingStatus = 'Uploaded';
        if (meeting.status === 'Failed_LLM' && meeting.transcript) {
          // If transcript exists, we can retry from LLM_Processing
          targetStatus = 'LLM_Processing';
        }

        // Update meeting status and reset retry scheduling
        await prisma.meeting.update({
          where: { id: meeting.id },
          data: {
            status: targetStatus,
            nextAutoRetryAt: null, // Will be set on next failure if needed
          },
        });

        // Enqueue processing job
        await enqueueProcessingJob(meeting.id);

        console.log(
          `[AutoRetry Worker] Scheduled retry ${meeting.autoRetryCount + 1}/${AUTO_RETRY_CONSTANTS.MAX_AUTO_RETRIES} for meeting ${meeting.id}`
        );

        processedCount++;
      } catch (error) {
        console.error(
          `[AutoRetry Worker] Failed to process retry for meeting ${meeting.id}:`,
          error
        );
        // Continue with next meeting
      }
    }

    console.log(`[AutoRetry Worker] Processed ${processedCount} retries`);
    return processedCount;
  } catch (error) {
    console.error('[AutoRetry Worker] Error in scheduleAutoRetries:', error);
    throw error;
  }
}








