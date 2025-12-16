/**
 * Meeting Module - Validation Service
 * Business logic for meeting validation (Accept/Reject)
 */

import { ValidationDecision } from '@prisma/client';
import { ValidateMeetingRequest } from './dto';
import { validateMeetingId, validateCanValidate, validateValidationDecision } from './validation';
import { MEETING_ERROR_CODES, MEETING_ERROR_MESSAGES } from './constants';
import { canValidate } from './rbac';
import { prisma } from '../prisma';
import { updateContextSummary } from '@/lib/client-kb/context-summary';
import { ContextSummaryInput } from '@/lib/client-kb/types';
import { generateShortId } from '../db/id-generator';
import { createModuleLogger } from '../logger';

const logger = createModuleLogger('Meeting:ValidationService');

export interface ValidationServiceError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Validate meeting (Accept/Reject) - only owner can do this
 */
export async function validateMeeting(
  meetingId: string,
  data: ValidateMeetingRequest,
  userId: string
): Promise<{ success: true; decision: ValidationDecision } | { error: ValidationServiceError }> {
  // Check if user can validate
  const accessCheck = await canValidate(meetingId, userId);
  if (!accessCheck.allowed) {
    return {
      error: {
        code: accessCheck.error!.code,
        message: accessCheck.error!.message,
      },
    };
  }

  // Validate meeting ID
  const idValidation = validateMeetingId(meetingId);
  if (!idValidation.valid) {
    return {
      error: {
        code: idValidation.error!.code,
        message: idValidation.error!.message,
      },
    };
  }

  // Validate decision
  const decisionValidation = validateValidationDecision(data.decision);
  if (!decisionValidation.valid) {
    return {
      error: {
        code: decisionValidation.error!.code,
        message: decisionValidation.error!.message,
      },
    };
  }

  try {
    // Get meeting with current status and artifacts for context summary update
    const meetingWithArtifacts = await prisma.meeting.findUnique({
      where: { id: meetingId },
      select: {
        id: true,
        status: true,
        clientId: true,
        title: true,
        createdAt: true,
        scenarioId: true,
        artifacts: {
          select: {
            id: true,
            artifactsPayload: true,
          },
        },
        meetingType: {
          select: {
            name: true,
          },
        },
        scenario: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!meetingWithArtifacts) {
      return {
        error: {
          code: MEETING_ERROR_CODES.MEETING_NOT_FOUND,
          message: MEETING_ERROR_MESSAGES[MEETING_ERROR_CODES.MEETING_NOT_FOUND],
        },
      };
    }

    // Validate that meeting is ready for validation
    const canValidateCheck = validateCanValidate(meetingWithArtifacts.status);
    if (!canValidateCheck.valid) {
      return {
        error: {
          code: canValidateCheck.error!.code,
          message: canValidateCheck.error!.message,
        },
      };
    }

    // Check if artifacts exist
    if (!meetingWithArtifacts.artifacts) {
      return {
        error: {
          code: MEETING_ERROR_CODES.MEETING_NOT_READY,
          message: 'Meeting artifacts not found',
        },
      };
    }

    // Create validation record and update meeting status in transaction
    await prisma.$transaction(async (tx) => {
      // Update meeting status
      const newStatus = data.decision === 'accepted' ? 'Validated' : 'Rejected';
      await tx.meeting.update({
        where: { id: meetingId },
        data: {
          status: newStatus,
          validatedAt: new Date(),
        },
      });

      // Create or update validation record
      const validationId = await generateShortId('validation');
      await tx.validation.upsert({
        where: { meetingId },
        create: {
          id: validationId,
          meetingId,
          validatedByUserId: userId,
          decision: data.decision,
          rejectionReason: data.decision === 'rejected' ? data.rejectionReason || null : null,
        },
        update: {
          validatedByUserId: userId,
          decision: data.decision,
          rejectionReason: data.decision === 'rejected' ? data.rejectionReason || null : null,
          validatedAt: new Date(),
        },
      });
    });

    // Update client context summary if accepted
    if (data.decision === 'accepted' && meetingWithArtifacts.artifacts) {
      const artifactsPayload = meetingWithArtifacts.artifacts.artifactsPayload as Record<string, unknown>;

      // Extract meeting_summary_for_context from artifacts
      // Support both old structure {artifacts: {...}, quality: {...}} and new structure
      let meetingSummaryForContext: string | null = null;
      
      if (artifactsPayload && typeof artifactsPayload === 'object') {
        // Extract meeting_summary_for_context (top level or inside artifacts)
        if ('meeting_summary_for_context' in artifactsPayload && typeof artifactsPayload.meeting_summary_for_context === 'string') {
          meetingSummaryForContext = artifactsPayload.meeting_summary_for_context;
        }
        
        let artifacts: Record<string, unknown>;
        
        if ('artifacts' in artifactsPayload) {
          // Old structure with wrapper
          artifacts = (artifactsPayload.artifacts as Record<string, unknown>) || {};
          // Check meeting_summary_for_context inside artifacts wrapper too
          if (!meetingSummaryForContext && 'meeting_summary_for_context' in artifacts && typeof artifacts.meeting_summary_for_context === 'string') {
            meetingSummaryForContext = artifacts.meeting_summary_for_context;
          }
        }
      }

      // Count validated meetings for this client to determine meeting number
      const validatedMeetingsCount = await prisma.meeting.count({
        where: {
          clientId: meetingWithArtifacts.clientId,
          status: 'Validated',
        },
      });
      const meetingNumber = validatedMeetingsCount + 1; // +1 because current meeting will be validated

      // Update context if meeting_summary_for_context exists
      if (meetingSummaryForContext) {
        const contextInput: ContextSummaryInput = {
          previousSummary: null, // Will be fetched inside updateContextSummary
          meetingMetadata: {
            meetingId,
            meetingType: meetingWithArtifacts.meetingType.name,
            title: meetingWithArtifacts.title || undefined,
            createdAt: meetingWithArtifacts.createdAt,
            scenarioName: meetingWithArtifacts.scenario?.name || undefined,
            meetingNumber,
            meetingSummaryForContext: meetingSummaryForContext,
          },
        };

        // Call asynchronously (don't block validation response)
        updateContextSummary(meetingWithArtifacts.clientId, contextInput).catch((error) => {
          logger.error('Failed to update context summary', error);
          // Log error but don't fail validation
        });
      }
    }

    return {
      success: true,
      decision: data.decision,
    };
  } catch (error) {
    return {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to validate meeting',
        details: { originalError: error instanceof Error ? error.message : 'Unknown error' },
      },
    };
  }
}

