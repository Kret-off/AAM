/**
 * Orchestrator LLM Processor
 * Handles LLM processing via OpenAI Adapter
 */

import { MeetingStatus } from '@prisma/client';
import { prisma } from '../../prisma';
import { processTranscript } from '../../openai-adapter';
import { updateMeetingStatus } from '../../meeting/service';
import { getContextSummary } from '../../client-kb/context-summary';
import { deleteUploadBlob } from '../cleanup';
import { ORCHESTRATOR_ERROR_CODES, ORCHESTRATOR_ERROR_MESSAGES } from '../constants';
import { scheduleAutoRetry } from '../auto-retry-utils';

export interface LLMResult {
  success: boolean;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Save processing error to database
 */
async function saveProcessingError(
  meetingId: string,
  stage: 'transcription' | 'llm' | 'system',
  errorCode: string,
  errorMessage: string,
  errorDetails?: Record<string, unknown>
): Promise<void> {
  try {
    const { generateShortId } = await import('../../db/id-generator');
    const errorId = await generateShortId('processing_error');
    await prisma.processingError.create({
      data: {
        id: errorId,
        meetingId,
        stage,
        errorCode,
        errorMessage,
        errorDetails: errorDetails ? (errorDetails as object) : undefined,
      },
    });
  } catch (error) {
    // Log but don't throw - error saving should not block status update
    console.error(`[LLM] Failed to save processing error:`, error);
  }
}

/**
 * Process LLM for a meeting
 */
export async function processLLM(meetingId: string): Promise<LLMResult> {
  try {
    // Check if artifacts already exist (idempotency)
    const existingArtifacts = await prisma.artifacts.findUnique({
      where: { meetingId },
      select: { id: true },
    });

    if (existingArtifacts) {
      // Artifacts already exist, skip LLM processing
      return { success: true };
    }

    // Get meeting with all required relations
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      select: {
        id: true,
        status: true,
        clientId: true,
        scenarioId: true,
        transcript: {
          select: {
            transcriptText: true,
            segments: true,
            keyterms: true,
            language: true,
          },
        },
        scenario: {
          select: {
            name: true,
            systemPrompt: true,
            outputSchema: true,
          },
        },
        participants: {
          select: {
            snapshotFullName: true,
            snapshotRoleTitle: true,
            snapshotCompanyName: true,
            snapshotDepartment: true,
          },
        },
        client: {
          select: {
            name: true,
          },
        },
        meetingType: {
          select: {
            name: true,
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

    if (!meeting.transcript) {
      return {
        success: false,
        error: {
          code: 'TRANSCRIPT_NOT_FOUND',
          message: 'Transcript not found for meeting',
        },
      };
    }

    if (!meeting.scenario) {
      return {
        success: false,
        error: {
          code: 'SCENARIO_NOT_FOUND',
          message: 'Scenario not found for meeting',
        },
      };
    }

    // Get client context summary
    const contextSummaryResult = await getContextSummary(meeting.clientId);
    const clientContextSummary =
      contextSummaryResult && 'summary' in contextSummaryResult
        ? contextSummaryResult.summary
        : null;

    // Prepare meeting metadata
    const meetingMetadata = {
      clientName: meeting.client.name,
      meetingTypeName: meeting.meetingType.name,
      scenarioName: meeting.scenario.name,
      participants: meeting.participants.map((p) => ({
        snapshotFullName: p.snapshotFullName,
        snapshotRoleTitle: p.snapshotRoleTitle,
        snapshotCompanyName: p.snapshotCompanyName,
        snapshotDepartment: p.snapshotDepartment,
      })),
    };

    // Call OpenAI Adapter
    const llmResult = await processTranscript({
      meetingId,
      transcriptText: meeting.transcript.transcriptText,
      segments: meeting.transcript.segments,
      keyterms: meeting.transcript.keyterms,
      language: meeting.transcript.language,
      systemPrompt: meeting.scenario.systemPrompt,
      outputSchema: meeting.scenario.outputSchema,
      meetingMetadata,
      clientContextSummary,
    });

    if ('error' in llmResult) {
      // Save error before updating status
      await saveProcessingError(
        meetingId,
        'llm',
        llmResult.error.code,
        llmResult.error.message,
        llmResult.error.details
      );
      
      // Update status to Failed_LLM
      await updateMeetingStatus(meetingId, 'Failed_LLM');
      
      // Schedule automatic retry if applicable
      await scheduleAutoRetry(meetingId);
      
      return {
        success: false,
        error: {
          code: llmResult.error.code,
          message: llmResult.error.message,
          details: llmResult.error.details,
        },
      };
    }

    // Save artifacts to database in transaction
    // Note: LLMInteraction records are already saved in processTranscript
    // This transaction ensures atomicity of artifacts creation
    // Save response directly - structure is defined by outputSchema
    await prisma.$transaction(async (tx) => {
      const { generateShortId } = await import('../../db/id-generator');
      const artifactsId = await generateShortId('artifacts');
      await tx.artifacts.create({
        data: {
          id: artifactsId,
          meetingId,
          artifactsPayload: llmResult.data as object,
        },
      });
    });

    // Update status to Ready
    const statusUpdate = await updateMeetingStatus(meetingId, 'Ready');
    if ('error' in statusUpdate) {
      return {
        success: false,
        error: {
          code: statusUpdate.error.code,
          message: statusUpdate.error.message,
        },
      };
    }

    // Cleanup: delete UploadBlob immediately after success
    await deleteUploadBlob(meetingId, true);

    return { success: true };
  } catch (error) {
    // Save error before updating status
    const errorDetails = {
      originalError: error instanceof Error ? error.message : 'Unknown error',
    };
    await saveProcessingError(
      meetingId,
      'llm',
      'INTERNAL_ERROR',
      'Failed to process LLM',
      errorDetails
    );
    
    // Update status to Failed_LLM on unexpected error
    await updateMeetingStatus(meetingId, 'Failed_LLM').catch(() => {
      // Ignore errors during status update
    });
    
    // Schedule automatic retry if applicable
    await scheduleAutoRetry(meetingId).catch((retryError) => {
      console.error(`[LLM] Failed to schedule auto retry:`, retryError);
    });

    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to process LLM',
        details: errorDetails,
      },
    };
  }
}

