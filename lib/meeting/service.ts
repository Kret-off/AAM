/**
 * Meeting Module Service
 * Business logic for meeting operations
 */

import { MeetingStatus } from '@prisma/client';
import {
  MeetingResponse,
  CreateMeetingRequest,
  UpdateMeetingRequest,
  MeetingDetailResponse,
} from './dto';
import { MeetingsQueryParams, PaginatedResponse } from './types';
import { validateMeetingId, validatePaginationParams, validateStatusTransition } from './validation';
import { MEETING_ERROR_CODES, MEETING_ERROR_MESSAGES, MEETING_CONSTANTS } from './constants';
import { checkMeetingAccess } from './rbac';
import { prisma } from '../prisma';
import { UserRole } from '@prisma/client';
import { generateShortId } from '../db/id-generator';
import { validateClientId } from '../client-kb/validation';
import { validateMeetingTypeId, validateScenarioId } from '../scenario/validation';
import { validateParticipantId } from '../directory/validation';
import { publishMeetingStatusUpdate } from '../realtime/pubsub';
import { createModuleLogger } from '../logger';

const logger = createModuleLogger('Meeting');

export interface MeetingServiceError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Create a new meeting with participants
 */
export async function createMeeting(
  data: CreateMeetingRequest,
  ownerUserId: string
): Promise<{ data: MeetingResponse } | { error: MeetingServiceError }> {
  try {
    // Validate client ID format
    const clientIdValidation = validateClientId(data.clientId);
    if (!clientIdValidation.valid) {
      return {
        error: {
          code: clientIdValidation.error!.code,
          message: clientIdValidation.error!.message,
        },
      };
    }

    // Validate meeting type ID format
    const meetingTypeIdValidation = validateMeetingTypeId(data.meetingTypeId);
    if (!meetingTypeIdValidation.valid) {
      return {
        error: {
          code: meetingTypeIdValidation.error!.code,
          message: meetingTypeIdValidation.error!.message,
        },
      };
    }

    // Validate scenario ID format
    const scenarioIdValidation = validateScenarioId(data.scenarioId);
    if (!scenarioIdValidation.valid) {
      return {
        error: {
          code: scenarioIdValidation.error!.code,
          message: scenarioIdValidation.error!.message,
        },
      };
    }

    // Validate participant IDs format if provided
    if (data.participantIds && data.participantIds.length > 0) {
      for (const participantId of data.participantIds) {
        const participantIdValidation = validateParticipantId(participantId);
        if (!participantIdValidation.valid) {
          return {
            error: {
              code: participantIdValidation.error!.code,
              message: participantIdValidation.error!.message,
            },
          };
        }
      }
    }

    // Validate that client exists
    const client = await prisma.client.findUnique({
      where: { id: data.clientId },
      select: { id: true, name: true },
    });

    if (!client) {
      return {
        error: {
          code: MEETING_ERROR_CODES.CLIENT_NOT_FOUND,
          message: MEETING_ERROR_MESSAGES[MEETING_ERROR_CODES.CLIENT_NOT_FOUND],
        },
      };
    }

    // Validate that meeting type exists
    const meetingType = await prisma.meetingType.findUnique({
      where: { id: data.meetingTypeId },
      select: { id: true, name: true },
    });

    if (!meetingType) {
      return {
        error: {
          code: MEETING_ERROR_CODES.MEETING_TYPE_NOT_FOUND,
          message: MEETING_ERROR_MESSAGES[MEETING_ERROR_CODES.MEETING_TYPE_NOT_FOUND],
        },
      };
    }

    // Validate that scenario exists and matches meeting type
    const scenario = await prisma.promptScenario.findUnique({
      where: { id: data.scenarioId },
      select: { id: true, name: true, meetingTypeId: true },
    });

    if (!scenario) {
      return {
        error: {
          code: MEETING_ERROR_CODES.SCENARIO_NOT_FOUND,
          message: MEETING_ERROR_MESSAGES[MEETING_ERROR_CODES.SCENARIO_NOT_FOUND],
        },
      };
    }

    // Validate that scenario belongs to the selected meeting type
    if (scenario.meetingTypeId !== data.meetingTypeId) {
      return {
        error: {
          code: MEETING_ERROR_CODES.SCENARIO_NOT_MATCHING_MEETING_TYPE,
          message: MEETING_ERROR_MESSAGES[MEETING_ERROR_CODES.SCENARIO_NOT_MATCHING_MEETING_TYPE],
        },
      };
    }

    // Validate participants exist and get snapshot data
    const participants = await prisma.directoryParticipant.findMany({
      where: {
        id: { in: data.participantIds },
        isActive: true,
      },
      select: {
        id: true,
        fullName: true,
        roleTitle: true,
        companyName: true,
        department: true,
      },
    });

    if (participants.length !== data.participantIds.length) {
      return {
        error: {
          code: MEETING_ERROR_CODES.PARTICIPANT_NOT_FOUND,
          message: MEETING_ERROR_MESSAGES[MEETING_ERROR_CODES.PARTICIPANT_NOT_FOUND],
        },
      };
    }

    // Get owner user info
    const owner = await prisma.user.findUnique({
      where: { id: ownerUserId },
      select: { id: true, name: true },
    });

    if (!owner) {
      return {
        error: {
          code: MEETING_ERROR_CODES.USER_NOT_FOUND,
          message: MEETING_ERROR_MESSAGES[MEETING_ERROR_CODES.USER_NOT_FOUND],
        },
      };
    }

    // Create meeting with participants in a transaction
    const meeting = await prisma.$transaction(async (tx) => {
      // Generate meeting ID
      let meetingId: string;
      try {
        meetingId = await generateShortId('meeting');
      } catch (error) {
        throw new Error(
          `Failed to generate meeting ID: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
      
      // Generate automatic title: use provided title or meetingId as default
      const autoTitle = data.title || meetingId;
      
      // Create meeting
      const newMeeting = await tx.meeting.create({
        data: {
          id: meetingId,
          clientId: data.clientId,
          ownerUserId,
          meetingTypeId: data.meetingTypeId,
          scenarioId: data.scenarioId,
          title: autoTitle,
          status: 'Uploaded',
        },
        select: {
          id: true,
          clientId: true,
          ownerUserId: true,
          meetingTypeId: true,
          scenarioId: true,
          title: true,
          status: true,
          createdAt: true,
          validatedAt: true,
        },
      });

      // Create meeting participants with snapshot data (only if there are participants)
      if (participants.length > 0) {
        await tx.meetingParticipant.createMany({
          data: participants.map((p) => ({
            meetingId: newMeeting.id,
            participantId: p.id,
            snapshotFullName: p.fullName,
            snapshotRoleTitle: p.roleTitle,
            snapshotCompanyName: p.companyName,
            snapshotDepartment: p.department,
          })),
        });
      }

      return newMeeting;
    });

    return {
      data: {
        id: meeting.id,
        clientId: meeting.clientId,
        clientName: client.name,
        ownerUserId: meeting.ownerUserId,
        ownerName: owner.name,
        meetingTypeId: meeting.meetingTypeId,
        meetingTypeName: meetingType.name,
        scenarioId: meeting.scenarioId,
        scenarioName: scenario.name,
        title: meeting.title,
        status: meeting.status,
        createdAt: meeting.createdAt.toISOString(),
        validatedAt: meeting.validatedAt?.toISOString() || null,
      },
    };
  } catch (error) {
    // Log error for debugging
    logger.error('Error creating meeting', error);
    
    // Check if it's a Prisma error
    if (error && typeof error === 'object' && 'code' in error) {
      const prismaError = error as { code: string; meta?: unknown };
      
      // Handle specific Prisma errors
      if (prismaError.code === 'P2002') {
        return {
          error: {
            code: 'DUPLICATE_ENTRY',
            message: 'Meeting with this ID already exists',
            details: { prismaCode: prismaError.code, meta: prismaError.meta },
          },
        };
      }
      
      if (prismaError.code === 'P2003') {
        return {
          error: {
            code: 'FOREIGN_KEY_CONSTRAINT',
            message: 'Invalid reference to related entity',
            details: { prismaCode: prismaError.code, meta: prismaError.meta },
          },
        };
      }
    }
    
    return {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create meeting',
        details: { 
          originalError: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        },
      },
    };
  }
}

/**
 * Get meeting by ID with RBAC check
 */
export async function getMeetingById(
  meetingId: string,
  userId: string,
  userRole: UserRole
): Promise<{ data: MeetingResponse } | { error: MeetingServiceError }> {
  // Check access
  const accessCheck = await checkMeetingAccess(meetingId, userId, userRole);
  if (!accessCheck.allowed) {
    return {
      error: {
        code: accessCheck.error!.code,
        message: accessCheck.error!.message,
      },
    };
  }

  try {
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      select: {
        id: true,
        clientId: true,
        client: {
          select: { name: true },
        },
        ownerUserId: true,
        owner: {
          select: { name: true },
        },
        meetingTypeId: true,
        meetingType: {
          select: { name: true },
        },
        scenarioId: true,
        scenario: {
          select: { name: true },
        },
        title: true,
        status: true,
        createdAt: true,
        validatedAt: true,
      },
    });

    if (!meeting) {
      return {
        error: {
          code: MEETING_ERROR_CODES.MEETING_NOT_FOUND,
          message: MEETING_ERROR_MESSAGES[MEETING_ERROR_CODES.MEETING_NOT_FOUND],
        },
      };
    }

    return {
      data: {
        id: meeting.id,
        clientId: meeting.clientId,
        clientName: meeting.client.name,
        ownerUserId: meeting.ownerUserId,
        ownerName: meeting.owner.name,
        meetingTypeId: meeting.meetingTypeId,
        meetingTypeName: meeting.meetingType.name,
        scenarioId: meeting.scenarioId,
        scenarioName: meeting.scenario.name,
        title: meeting.title,
        status: meeting.status,
        createdAt: meeting.createdAt.toISOString(),
        validatedAt: meeting.validatedAt?.toISOString() || null,
      },
    };
  } catch (error) {
    return {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch meeting',
        details: { originalError: error instanceof Error ? error.message : 'Unknown error' },
      },
    };
  }
}

/**
 * Get meeting detail with all relations
 */
export async function getMeetingDetail(
  meetingId: string,
  userId: string,
  userRole: UserRole
): Promise<{ data: MeetingDetailResponse } | { error: MeetingServiceError }> {
  logger.debug('getMeetingDetail called', { meetingId, userId, userRole });

  // Check access
  const accessCheck = await checkMeetingAccess(meetingId, userId, userRole);
  if (!accessCheck.allowed) {
    logger.debug('Access denied', accessCheck.error);
    return {
      error: {
        code: accessCheck.error!.code,
        message: accessCheck.error!.message,
      },
    };
  }

  logger.debug('Access granted, fetching meeting data');

  try {
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      select: {
        id: true,
        clientId: true,
        client: {
          select: { name: true },
        },
        ownerUserId: true,
        owner: {
          select: { name: true },
        },
        meetingTypeId: true,
        meetingType: {
          select: { name: true },
        },
        scenarioId: true,
        scenario: {
          select: { name: true },
        },
        title: true,
        status: true,
        createdAt: true,
        validatedAt: true,
        autoRetryCount: true,
        lastAutoRetryAt: true,
        nextAutoRetryAt: true,
        participants: {
          select: {
            participantId: true,
            snapshotFullName: true,
            snapshotRoleTitle: true,
            snapshotCompanyName: true,
            snapshotDepartment: true,
            addedAt: true,
          },
        },
        viewers: {
          select: {
            userId: true,
            user: {
              select: { name: true },
            },
            addedAt: true,
            addedByUserId: true,
            addedByUser: {
              select: { name: true },
            },
          },
        },
        transcript: {
          select: { id: true },
        },
        artifacts: {
          select: { id: true },
        },
        validation: {
          select: {
            decision: true,
          },
        },
        processingErrors: {
          orderBy: {
            occurredAt: 'desc',
          },
          take: 10,
          select: {
            id: true,
            stage: true,
            errorCode: true,
            errorMessage: true,
            errorDetails: true,
            occurredAt: true,
          },
        },
      },
    });

    logger.debug('Meeting query result', {
      found: !!meeting,
      hasClient: !!meeting?.client,
      hasOwner: !!meeting?.owner,
      hasMeetingType: !!meeting?.meetingType,
      hasScenario: !!meeting?.scenario,
      status: meeting?.status,
    });

    if (!meeting) {
      logger.error('Meeting not found', null, { meetingId });
      return {
        error: {
          code: MEETING_ERROR_CODES.MEETING_NOT_FOUND,
          message: MEETING_ERROR_MESSAGES[MEETING_ERROR_CODES.MEETING_NOT_FOUND],
        },
      };
    }

    // Validate required relations exist
    if (!meeting.client) {
      logger.error('Missing client relation', null, { meetingId, clientId: meeting.clientId });
      return {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch meeting details: client relation missing',
          details: { meetingId },
        },
      };
    }

    if (!meeting.owner) {
      return {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch meeting details: owner relation missing',
          details: { meetingId },
        },
      };
    }

    if (!meeting.meetingType) {
      return {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch meeting details: meetingType relation missing',
          details: { meetingId },
        },
      };
    }

    if (!meeting.scenario) {
      logger.error('Missing scenario relation', null, { meetingId, scenarioId: meeting.scenarioId });
      return {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch meeting details: scenario relation missing',
          details: { meetingId },
        },
      };
    }

    logger.debug('All relations present, building response');

    try {
      // Build response data - relations are already validated above
      const responseData: MeetingDetailResponse = {
        id: meeting.id,
        clientId: meeting.clientId,
        clientName: meeting.client!.name, // Non-null assertion: validated above
        ownerUserId: meeting.ownerUserId,
        ownerName: meeting.owner!.name, // Non-null assertion: validated above
        meetingTypeId: meeting.meetingTypeId,
        meetingTypeName: meeting.meetingType!.name, // Non-null assertion: validated above
        scenarioId: meeting.scenarioId,
        scenarioName: meeting.scenario!.name, // Non-null assertion: validated above
        title: meeting.title,
        status: meeting.status,
        createdAt: meeting.createdAt.toISOString(),
        validatedAt: meeting.validatedAt?.toISOString() || null,
        autoRetryCount: meeting.autoRetryCount,
        lastAutoRetryAt: meeting.lastAutoRetryAt?.toISOString() || null,
        nextAutoRetryAt: meeting.nextAutoRetryAt?.toISOString() || null,
        participants: meeting.participants.map((p) => ({
          participantId: p.participantId,
          snapshotFullName: p.snapshotFullName,
          snapshotRoleTitle: p.snapshotRoleTitle,
          snapshotCompanyName: p.snapshotCompanyName,
          snapshotDepartment: p.snapshotDepartment,
          addedAt: p.addedAt.toISOString(),
        })),
        viewers: meeting.viewers
          .filter((v) => v.user && v.addedByUser) // Filter out viewers with missing user relations
          .map((v) => ({
            userId: v.userId,
            userName: v.user!.name, // Non-null assertion: filtered above
            addedAt: v.addedAt.toISOString(),
            addedByUserId: v.addedByUserId,
            addedByName: v.addedByUser!.name, // Non-null assertion: filtered above
          })),
        hasTranscript: meeting.transcript !== null,
        hasArtifacts: meeting.artifacts !== null,
        hasValidation: meeting.validation !== null,
        validationDecision: meeting.validation?.decision,
        latestError: meeting.processingErrors.length > 0
          ? {
              stage: meeting.processingErrors[0].stage,
              code: meeting.processingErrors[0].errorCode,
              message: meeting.processingErrors[0].errorMessage,
              details: meeting.processingErrors[0].errorDetails as Record<string, unknown> | undefined,
              occurredAt: meeting.processingErrors[0].occurredAt.toISOString(),
            }
          : undefined,
        errorHistory: meeting.processingErrors.map((err) => ({
          id: err.id,
          stage: err.stage,
          code: err.errorCode,
          message: err.errorMessage,
          details: err.errorDetails as Record<string, unknown> | undefined,
          occurredAt: err.occurredAt.toISOString(),
        })),
      };

      logger.debug('Response data built successfully');
      return { data: responseData };
    } catch (buildError) {
      logger.error('Error building response data', buildError);
      throw buildError; // Re-throw to be caught by outer catch
    }
  } catch (error) {
    logger.error('Error in getMeetingDetail', error);
    return {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch meeting details',
        details: {
          originalError: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        },
      },
    };
  }
}

/**
 * Get paginated list of meetings with filters
 */
export async function getMeetings(
  params: MeetingsQueryParams,
  userId: string,
  userRole: UserRole
): Promise<{ data: PaginatedResponse<MeetingResponse> } | { error: MeetingServiceError }> {
  // Validate pagination
  const paginationValidation = validatePaginationParams({
    page: params.page,
    pageSize: params.pageSize,
  });

  if (!paginationValidation.valid) {
    return {
      error: {
        code: paginationValidation.error!.code,
        message: paginationValidation.error!.message,
      },
    };
  }

  const { page, pageSize } = paginationValidation;
  const skip = (page - 1) * pageSize;

  try {
    // Build where clause
    const where: {
      status?: MeetingStatus;
      clientId?: string;
      ownerUserId?: string;
      meetingTypeId?: string;
      OR?: Array<{
        title?: { contains: string; mode: 'insensitive' };
      }>;
    } = {};

    // Apply filters
    if (params.filter?.status) {
      where.status = params.filter.status;
    }
    if (params.filter?.clientId) {
      where.clientId = params.filter.clientId;
    }
    if (params.filter?.meetingTypeId) {
      where.meetingTypeId = params.filter.meetingTypeId;
    }

    // For non-admin users, filter by owner or viewer
    if (userRole !== 'ADMIN') {
      where.OR = [
        { ownerUserId: userId },
        {
          viewers: {
            some: {
              userId,
            },
          },
        },
      ];
    } else if (params.filter?.ownerUserId) {
      // Admin can filter by owner
      where.ownerUserId = params.filter.ownerUserId;
    }

    // Apply search filter
    if (params.filter?.search) {
      const searchTerm = params.filter.search.trim();
      if (where.OR) {
        where.OR.push({ title: { contains: searchTerm, mode: 'insensitive' } });
      } else {
        where.OR = [{ title: { contains: searchTerm, mode: 'insensitive' } }];
      }
    }

    // Get total count and meetings in parallel
    const [total, meetings] = await Promise.all([
      prisma.meeting.count({ where }),
      prisma.meeting.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          clientId: true,
          client: {
            select: { name: true },
          },
          ownerUserId: true,
          owner: {
            select: { name: true },
          },
          meetingTypeId: true,
          meetingType: {
            select: { name: true },
          },
          scenarioId: true,
          scenario: {
            select: { name: true },
          },
          title: true,
          status: true,
          createdAt: true,
          validatedAt: true,
        },
      }),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      data: {
        items: meetings.map((meeting) => ({
          id: meeting.id,
          clientId: meeting.clientId,
          clientName: meeting.client.name,
          ownerUserId: meeting.ownerUserId,
          ownerName: meeting.owner.name,
          meetingTypeId: meeting.meetingTypeId,
          meetingTypeName: meeting.meetingType.name,
          scenarioId: meeting.scenarioId,
          scenarioName: meeting.scenario.name,
          title: meeting.title,
          status: meeting.status,
          createdAt: meeting.createdAt.toISOString(),
          validatedAt: meeting.validatedAt?.toISOString() || null,
        })),
        total,
        page,
        pageSize,
        totalPages,
      },
    };
  } catch (error) {
    return {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch meetings',
        details: { originalError: error instanceof Error ? error.message : 'Unknown error' },
      },
    };
  }
}

/**
 * Update meeting status (for pipeline use)
 */
export async function updateMeetingStatus(
  meetingId: string,
  newStatus: MeetingStatus
): Promise<{ data: MeetingResponse } | { error: MeetingServiceError }> {
  try {
    // Get current meeting
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      select: {
        id: true,
        status: true,
        clientId: true,
        client: {
          select: { name: true },
        },
        ownerUserId: true,
        owner: {
          select: { name: true },
        },
        meetingTypeId: true,
        meetingType: {
          select: { name: true },
        },
        scenarioId: true,
        scenario: {
          select: { name: true },
        },
        title: true,
        createdAt: true,
        validatedAt: true,
      },
    });

    if (!meeting) {
      return {
        error: {
          code: MEETING_ERROR_CODES.MEETING_NOT_FOUND,
          message: MEETING_ERROR_MESSAGES[MEETING_ERROR_CODES.MEETING_NOT_FOUND],
        },
      };
    }

    // Validate status transition
    const transitionValidation = validateStatusTransition(meeting.status, newStatus);
    if (!transitionValidation.valid) {
      return {
        error: {
          code: transitionValidation.error!.code,
          message: transitionValidation.error!.message,
        },
      };
    }

    // Special check: Failed_LLM -> LLM_Processing requires transcript
    if (meeting.status === 'Failed_LLM' && newStatus === 'LLM_Processing') {
      const transcript = await prisma.transcript.findUnique({
        where: { meetingId },
        select: { id: true },
      });

      if (!transcript) {
        return {
          error: {
            code: MEETING_ERROR_CODES.INVALID_STATUS_TRANSITION,
            message: 'Cannot transition to LLM_Processing without transcript',
          },
        };
      }
    }

    // Update status
    const updatedMeeting = await prisma.meeting.update({
      where: { id: meetingId },
      data: {
        status: newStatus,
        validatedAt: newStatus === 'Validated' || newStatus === 'Rejected' ? new Date() : undefined,
      },
      select: {
        id: true,
        clientId: true,
        client: {
          select: { name: true },
        },
        ownerUserId: true,
        owner: {
          select: { name: true },
        },
        meetingTypeId: true,
        meetingType: {
          select: { name: true },
        },
        scenarioId: true,
        scenario: {
          select: { name: true },
        },
        title: true,
        status: true,
        createdAt: true,
        validatedAt: true,
      },
    });

    // Check for transcript and artifacts to include in event
    const [transcript, artifacts] = await Promise.all([
      prisma.transcript.findUnique({
        where: { meetingId },
        select: { id: true },
      }),
      prisma.artifacts.findUnique({
        where: { meetingId },
        select: { id: true },
      }),
    ]);

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/9c7ad797-58f6-4b84-8fea-d98c57d9b1b6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/meeting/service.ts:893',message:'BEFORE publishMeetingStatusUpdate call',data:{meetingId,newStatus,hasTranscript:!!transcript,hasArtifacts:!!artifacts},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    // Publish status update event (non-blocking, errors are handled inside)
    publishMeetingStatusUpdate(meetingId, newStatus, {
      hasTranscript: !!transcript,
      hasArtifacts: !!artifacts,
    }).catch((error) => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/9c7ad797-58f6-4b84-8fea-d98c57d9b1b6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/meeting/service.ts:900',message:'publishMeetingStatusUpdate catch error',data:{meetingId,newStatus,error:error instanceof Error ? error.message : String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      // Log but don't throw - status update should not fail due to pub/sub issues
      logger.error('Failed to publish status update event', error);
    });

    return {
      data: {
        id: updatedMeeting.id,
        clientId: updatedMeeting.clientId,
        clientName: updatedMeeting.client.name,
        ownerUserId: updatedMeeting.ownerUserId,
        ownerName: updatedMeeting.owner.name,
        meetingTypeId: updatedMeeting.meetingTypeId,
        meetingTypeName: updatedMeeting.meetingType.name,
        scenarioId: updatedMeeting.scenarioId,
        scenarioName: updatedMeeting.scenario.name,
        title: updatedMeeting.title,
        status: updatedMeeting.status,
        createdAt: updatedMeeting.createdAt.toISOString(),
        validatedAt: updatedMeeting.validatedAt?.toISOString() || null,
      },
    };
  } catch (error) {
    return {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update meeting status',
        details: { originalError: error instanceof Error ? error.message : 'Unknown error' },
      },
    };
  }
}

