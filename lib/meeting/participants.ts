/**
 * Meeting Module - Participants Service
 * Business logic for meeting participants management
 */

import { MeetingParticipantResponse } from './dto';
import { ParticipantSnapshot } from './types';
import { validateMeetingId } from './validation';
import { MEETING_ERROR_CODES, MEETING_ERROR_MESSAGES } from './constants';
import { prisma } from '../prisma';

export interface ParticipantsServiceError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Add participants to meeting with snapshot data
 */
export async function addParticipants(
  meetingId: string,
  participantIds: string[]
): Promise<{ data: MeetingParticipantResponse[] } | { error: ParticipantsServiceError }> {
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

  try {
    // Verify meeting exists
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      select: { id: true },
    });

    if (!meeting) {
      return {
        error: {
          code: MEETING_ERROR_CODES.MEETING_NOT_FOUND,
          message: MEETING_ERROR_MESSAGES[MEETING_ERROR_CODES.MEETING_NOT_FOUND],
        },
      };
    }

    // Get participants with snapshot data
    const participants = await prisma.directoryParticipant.findMany({
      where: {
        id: { in: participantIds },
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

    if (participants.length !== participantIds.length) {
      return {
        error: {
          code: MEETING_ERROR_CODES.PARTICIPANT_NOT_FOUND,
          message: MEETING_ERROR_MESSAGES[MEETING_ERROR_CODES.PARTICIPANT_NOT_FOUND],
        },
      };
    }

    // Create meeting participants with snapshot data
    const createdParticipants = await prisma.$transaction(async (tx) => {
      return await Promise.all(
        participants.map((p) =>
          tx.meetingParticipant.upsert({
            where: {
              meetingId_participantId: {
                meetingId,
                participantId: p.id,
              },
            },
            create: {
              meetingId,
              participantId: p.id,
              snapshotFullName: p.fullName,
              snapshotRoleTitle: p.roleTitle,
              snapshotCompanyName: p.companyName,
              snapshotDepartment: p.department,
            },
            update: {
              snapshotFullName: p.fullName,
              snapshotRoleTitle: p.roleTitle,
              snapshotCompanyName: p.companyName,
              snapshotDepartment: p.department,
            },
          })
        )
      );
    });

    return {
      data: createdParticipants.map((p) => ({
        participantId: p.participantId,
        snapshotFullName: p.snapshotFullName,
        snapshotRoleTitle: p.snapshotRoleTitle,
        snapshotCompanyName: p.snapshotCompanyName,
        snapshotDepartment: p.snapshotDepartment,
        addedAt: p.addedAt.toISOString(),
      })),
    };
  } catch (error) {
    return {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to add participants',
        details: { originalError: error instanceof Error ? error.message : 'Unknown error' },
      },
    };
  }
}

/**
 * Remove participant from meeting
 */
export async function removeParticipant(
  meetingId: string,
  participantId: string
): Promise<{ success: true } | { error: ParticipantsServiceError }> {
  // Validate IDs
  const meetingIdValidation = validateMeetingId(meetingId);
  if (!meetingIdValidation.valid) {
    return {
      error: {
        code: meetingIdValidation.error!.code,
        message: meetingIdValidation.error!.message,
      },
    };
  }

  try {
    await prisma.meetingParticipant.delete({
      where: {
        meetingId_participantId: {
          meetingId,
          participantId,
        },
      },
    });

    return { success: true };
  } catch (error) {
    return {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to remove participant',
        details: { originalError: error instanceof Error ? error.message : 'Unknown error' },
      },
    };
  }
}

/**
 * Get meeting participants
 */
export async function getMeetingParticipants(
  meetingId: string
): Promise<{ data: MeetingParticipantResponse[] } | { error: ParticipantsServiceError }> {
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

  try {
    const participants = await prisma.meetingParticipant.findMany({
      where: { meetingId },
      select: {
        participantId: true,
        snapshotFullName: true,
        snapshotRoleTitle: true,
        snapshotCompanyName: true,
        snapshotDepartment: true,
        addedAt: true,
      },
      orderBy: {
        addedAt: 'asc',
      },
    });

    return {
      data: participants.map((p) => ({
        participantId: p.participantId,
        snapshotFullName: p.snapshotFullName,
        snapshotRoleTitle: p.snapshotRoleTitle,
        snapshotCompanyName: p.snapshotCompanyName,
        snapshotDepartment: p.snapshotDepartment,
        addedAt: p.addedAt.toISOString(),
      })),
    };
  } catch (error) {
    return {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch participants',
        details: { originalError: error instanceof Error ? error.message : 'Unknown error' },
      },
    };
  }
}





