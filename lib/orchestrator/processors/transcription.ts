/**
 * Orchestrator Transcription Processor
 * Handles STT processing via Deepgram
 */

import { MeetingStatus } from '@prisma/client';
import { prisma } from '../../prisma';
import { transcribe } from '../../deepgram-adapter';
import { updateMeetingStatus } from '../../meeting/service';
import { downloadFileFromS3 } from '../s3-utils';
import { ORCHESTRATOR_ERROR_CODES, ORCHESTRATOR_ERROR_MESSAGES } from '../constants';
import { scheduleAutoRetry } from '../auto-retry-utils';
import { createModuleLogger } from '../../logger';
import { saveProcessingError } from '../error-handler';

const logger = createModuleLogger('Orchestrator:Transcription');

export interface TranscriptionResult {
  success: boolean;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Process transcription for a meeting
 */
export async function processTranscription(meetingId: string): Promise<TranscriptionResult> {
  try {
    // Check if transcript already exists (idempotency)
    const existingTranscript = await prisma.transcript.findUnique({
      where: { meetingId },
      select: { id: true },
    });

    if (existingTranscript) {
      // Transcript already exists, skip transcription
      return { success: true };
    }

    // Get meeting with upload blob and scenario
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      select: {
        id: true,
        status: true,
        uploadBlob: {
          select: {
            id: true,
            storagePath: true,
            mimeType: true,
          },
        },
        scenario: {
          select: {
            keyterms: true,
          },
        },
      },
    });

    if (!meeting) {
      return {
        success: false,
        error: {
          code: ORCHESTRATOR_ERROR_CODES.MEETING_NOT_FOUND,
          message: ORCHESTRATOR_ERROR_MESSAGES[ORCHESTRATOR_ERROR_CODES.MEETING_NOT_FOUND],
        },
      };
    }

    if (!meeting.uploadBlob) {
      return {
        success: false,
        error: {
          code: ORCHESTRATOR_ERROR_CODES.UPLOAD_BLOB_NOT_FOUND,
          message: ORCHESTRATOR_ERROR_MESSAGES[ORCHESTRATOR_ERROR_CODES.UPLOAD_BLOB_NOT_FOUND],
        },
      };
    }

    // Update status to Transcribing
    if (meeting.status === 'Uploaded') {
      const statusUpdate = await updateMeetingStatus(meetingId, 'Transcribing');
      if ('error' in statusUpdate) {
        return {
          success: false,
          error: {
            code: statusUpdate.error.code,
            message: statusUpdate.error.message,
          },
        };
      }
    }

    // Download file from S3 as Buffer
    let fileBuffer: Buffer;
    try {
      logger.debug(`Downloading file from S3 for meeting ${meetingId}`);
      fileBuffer = await downloadFileFromS3(meeting.uploadBlob.storagePath);
      logger.debug(`File downloaded successfully`, { meetingId, size: fileBuffer.length });
    } catch (error) {
      // Save error before updating status
      const errorDetails = {
        originalError: error instanceof Error ? error.message : 'Unknown error',
        storagePath: meeting.uploadBlob.storagePath,
      };
      await saveProcessingError(
        meetingId,
        'transcription',
        'S3_DOWNLOAD_ERROR',
        'Failed to download file from S3',
        errorDetails
      );
      
      // Update status to Failed_Transcription on download error
      await updateMeetingStatus(meetingId, 'Failed_Transcription');
      
      // Schedule automatic retry if applicable
      await scheduleAutoRetry(meetingId);
      
      return {
        success: false,
        error: {
          code: 'S3_DOWNLOAD_ERROR',
          message: 'Failed to download file from S3',
          details: errorDetails,
        },
      };
    }

    // Get keyterms from scenario (if available)
    const keyterms = meeting.scenario?.keyterms || [];

    // Call Deepgram transcription with file buffer
    logger.info(`Calling Deepgram API for meeting ${meetingId}`);
    if (keyterms.length > 0) {
      logger.debug(`Using ${keyterms.length} keyterms for improved transcription`);
    }
    const transcriptionResult = await transcribe({
      fileBuffer,
      language: 'ru', // Russian language by default
      keyterms: keyterms.length > 0 ? keyterms : undefined,
    });

    if ('error' in transcriptionResult) {
      logger.error(`Deepgram transcription failed for meeting ${meetingId}`, transcriptionResult.error, {
        code: transcriptionResult.error.code,
        details: transcriptionResult.error.details,
      });
      
      // Save error before updating status
      await saveProcessingError(
        meetingId,
        'transcription',
        transcriptionResult.error.code,
        transcriptionResult.error.message,
        transcriptionResult.error.details
      );
      
      // Update status to Failed_Transcription
      await updateMeetingStatus(meetingId, 'Failed_Transcription');
      
      // Schedule automatic retry if applicable
      await scheduleAutoRetry(meetingId);
      
      return {
        success: false,
        error: {
          code: transcriptionResult.error.code,
          message: transcriptionResult.error.message,
          details: transcriptionResult.error.details,
        },
      };
    }

    logger.info(`Deepgram transcription successful for meeting ${meetingId}`, {
      transcriptLength: transcriptionResult.data.transcriptText.length,
      segmentsCount: transcriptionResult.data.segments.length,
    });

    // Save transcript to database
    logger.debug(`Saving transcript to database for meeting ${meetingId}`);
    try {
      const { generateShortId } = await import('../../db/id-generator');
      const transcriptId = await generateShortId('transcript');
      await prisma.transcript.create({
        data: {
          id: transcriptId,
          meetingId,
          transcriptText: transcriptionResult.data.transcriptText,
          segments: transcriptionResult.data.segments,
          keyterms: transcriptionResult.data.keyterms,
          language: transcriptionResult.data.language,
        },
      });
      logger.info(`Transcript saved successfully for meeting ${meetingId}`);
    } catch (dbError: any) {
      logger.error(`Failed to save transcript to database`, dbError, {
        code: dbError.code,
      });
      throw dbError;
    }

    // Update status to LLM_Processing
    const statusUpdate = await updateMeetingStatus(meetingId, 'LLM_Processing');
    if ('error' in statusUpdate) {
      return {
        success: false,
        error: {
          code: statusUpdate.error.code,
          message: statusUpdate.error.message,
        },
      };
    }

    return { success: true };
  } catch (error) {
    logger.error(`Unexpected error processing transcription for meeting ${meetingId}`, error);
    
    // Save error before updating status
    const errorDetails = {
      originalError: error instanceof Error ? error.message : 'Unknown error',
      errorName: error instanceof Error ? error.name : 'Unknown',
      errorStack: error instanceof Error ? error.stack : 'No stack trace',
    };
    await saveProcessingError(
      meetingId,
      'transcription',
      'INTERNAL_ERROR',
      'Failed to process transcription',
      errorDetails
    );
    
    // Update status to Failed_Transcription on unexpected error
    await updateMeetingStatus(meetingId, 'Failed_Transcription').catch((statusError) => {
      logger.error(`Failed to update status to Failed_Transcription`, statusError);
    });
    
    // Schedule automatic retry if applicable
    await scheduleAutoRetry(meetingId).catch((retryError) => {
      logger.error(`Failed to schedule auto retry`, retryError);
    });

    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to process transcription',
        details: errorDetails,
      },
    };
  }
}

