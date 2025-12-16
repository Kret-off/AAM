/**
 * Auto Retry Utilities
 * Helper functions for scheduling automatic retries
 */

import { prisma } from '../prisma';
import { AUTO_RETRY_CONSTANTS } from './constants';
import { calculateNextRetryTime } from './auto-retry';
import { enqueueProcessingJobWithDelay } from './queue';
import { createModuleLogger } from '../logger';

const logger = createModuleLogger('Orchestrator:AutoRetryUtils');

/**
 * Schedule automatic retry for a failed meeting
 * Returns true if retry was scheduled, false if max retries reached
 */
export async function scheduleAutoRetry(meetingId: string): Promise<boolean> {
  try {
    // Get current meeting state
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      select: {
        id: true,
        autoRetryCount: true,
        status: true,
        uploadBlob: {
          select: {
            id: true,
            expiresAt: true,
            deletedAt: true,
          },
        },
      },
    });

    if (!meeting) {
      logger.error(`Meeting ${meetingId} not found`);
      return false;
    }

    // Check if max retries reached
    if (meeting.autoRetryCount >= AUTO_RETRY_CONSTANTS.MAX_AUTO_RETRIES) {
      logger.info(
        `Max retries reached for meeting ${meetingId} (${meeting.autoRetryCount}/${AUTO_RETRY_CONSTANTS.MAX_AUTO_RETRIES})`
      );
      return false;
    }

    // Check if uploadBlob is still available
    if (!meeting.uploadBlob || meeting.uploadBlob.deletedAt || meeting.uploadBlob.expiresAt) {
      const expiresAt = meeting.uploadBlob?.expiresAt;
      if (expiresAt && new Date(expiresAt) < new Date()) {
        logger.info(`UploadBlob expired for meeting ${meetingId}`);
        return false;
      }
    }

    // Calculate next retry time
    const nextRetryAt = calculateNextRetryTime(meeting.autoRetryCount);
    const delayMs = nextRetryAt.getTime() - Date.now();

    if (delayMs <= 0) {
      logger.info(`Delay is negative or zero for meeting ${meetingId}, scheduling immediately`);
    }

    // Update meeting with retry info
    await prisma.meeting.update({
      where: { id: meetingId },
      data: {
        nextAutoRetryAt: nextRetryAt,
        lastAutoRetryAt: new Date(),
        autoRetryCount: meeting.autoRetryCount + 1,
      },
    });

    // Schedule job with delay
    await enqueueProcessingJobWithDelay(meetingId, Math.max(0, delayMs));

    logger.info(
      `Scheduled retry ${meeting.autoRetryCount + 1}/${AUTO_RETRY_CONSTANTS.MAX_AUTO_RETRIES} for meeting ${meetingId} at ${nextRetryAt.toISOString()}`
    );

    return true;
  } catch (error) {
    logger.error(`Failed to schedule retry for meeting ${meetingId}`, error);
    return false;
  }
}








