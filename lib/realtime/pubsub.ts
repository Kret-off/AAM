/**
 * Real-time Pub/Sub Utilities
 * Redis Pub/Sub for meeting status updates
 */

import { MeetingStatus } from '@prisma/client';
import { getRedisConnection } from '../queue';
import { createModuleLogger } from '../logger';

const logger = createModuleLogger('PubSub');

export interface MeetingStatusUpdateEvent {
  meetingId: string;
  status: MeetingStatus;
  timestamp: string;
  data?: {
    hasTranscript?: boolean;
    hasArtifacts?: boolean;
  };
}

/**
 * Publish meeting status update event to Redis Pub/Sub
 * @param meetingId - Meeting ID
 * @param status - New meeting status
 * @param data - Optional additional data (hasTranscript, hasArtifacts)
 */
export async function publishMeetingStatusUpdate(
  meetingId: string,
  status: MeetingStatus,
  data?: {
    hasTranscript?: boolean;
    hasArtifacts?: boolean;
  }
): Promise<void> {
  try {
    const redis = getRedisConnection();
    const channel = `meeting:${meetingId}:status`;
    
    const event: MeetingStatusUpdateEvent = {
      meetingId,
      status,
      timestamp: new Date().toISOString(),
      data,
    };

    const subscribers = await redis.publish(channel, JSON.stringify(event));
    
    logger.debug(`Published status update for meeting ${meetingId}`, { status, subscribers });
  } catch (error) {
    // Log error but don't throw - status update should not fail due to pub/sub issues
    logger.error(`Failed to publish status update for meeting ${meetingId}`, error, { status });
  }
}

