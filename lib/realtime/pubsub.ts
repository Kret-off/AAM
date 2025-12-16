/**
 * Real-time Pub/Sub Utilities
 * Redis Pub/Sub for meeting status updates
 */

import { MeetingStatus } from '@prisma/client';
import { getRedisConnection } from '../queue';

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
  // #region agent log
  const logEntry = {location:'lib/realtime/pubsub.ts:25',message:'publishMeetingStatusUpdate ENTRY',data:{meetingId,status,hasData:!!data},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'};
  try { await fetch('http://127.0.0.1:7242/ingest/9c7ad797-58f6-4b84-8fea-d98c57d9b1b6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logEntry)}); } catch {}
  try { const fs = await import('fs/promises'); await fs.appendFile('/Users/mac/Assist after meeting(AAM)/.cursor/debug.log', JSON.stringify(logEntry) + '\n'); } catch {}
  // #endregion
  try {
    const redis = getRedisConnection();
    const channel = `meeting:${meetingId}:status`;
    
    const event: MeetingStatusUpdateEvent = {
      meetingId,
      status,
      timestamp: new Date().toISOString(),
      data,
    };

    // #region agent log
    const logBefore = {location:'lib/realtime/pubsub.ts:44',message:'BEFORE redis.publish',data:{channel,eventJson:JSON.stringify(event)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'};
    try { await fetch('http://127.0.0.1:7242/ingest/9c7ad797-58f6-4b84-8fea-d98c57d9b1b6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logBefore)}); } catch {}
    try { const fs = await import('fs/promises'); await fs.appendFile('/Users/mac/Assist after meeting(AAM)/.cursor/debug.log', JSON.stringify(logBefore) + '\n'); } catch {}
    // #endregion

    const subscribers = await redis.publish(channel, JSON.stringify(event));
    
    // #region agent log
    const logAfter = {location:'lib/realtime/pubsub.ts:46',message:'AFTER redis.publish SUCCESS',data:{channel,subscribers,eventJson:JSON.stringify(event)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'};
    try { await fetch('http://127.0.0.1:7242/ingest/9c7ad797-58f6-4b84-8fea-d98c57d9b1b6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logAfter)}); } catch {}
    try { const fs = await import('fs/promises'); await fs.appendFile('/Users/mac/Assist after meeting(AAM)/.cursor/debug.log', JSON.stringify(logAfter) + '\n'); } catch {}
    // #endregion
    
    console.log(`[PubSub] Published status update for meeting ${meetingId}: ${status}`);
  } catch (error) {
    // #region agent log
    const logError = {location:'lib/realtime/pubsub.ts:50',message:'publishMeetingStatusUpdate ERROR',data:{meetingId,status,error:error instanceof Error ? error.message : String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'};
    try { await fetch('http://127.0.0.1:7242/ingest/9c7ad797-58f6-4b84-8fea-d98c57d9b1b6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logError)}); } catch {}
    try { const fs = await import('fs/promises'); await fs.appendFile('/Users/mac/Assist after meeting(AAM)/.cursor/debug.log', JSON.stringify(logError) + '\n'); } catch {}
    // #endregion
    // Log error but don't throw - status update should not fail due to pub/sub issues
    console.error(`[PubSub] Failed to publish status update for meeting ${meetingId}:`, error);
  }
}

