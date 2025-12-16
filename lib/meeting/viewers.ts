/**
 * Meeting Module - Viewers Service
 * Business logic for meeting viewers and ownership transfer
 */

import { MeetingViewerResponse, TransferOwnershipRequest } from './dto';
import { validateMeetingId } from './validation';
import { MEETING_ERROR_CODES, MEETING_ERROR_MESSAGES } from './constants';
import { checkOwnerAccess } from './rbac';
import { prisma } from '../prisma';

export interface ViewersServiceError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Add viewer to meeting (only owner can do this)
 */
export async function addViewer(
  meetingId: string,
  userId: string,
  addedByUserId: string
): Promise<{ data: MeetingViewerResponse } | { error: ViewersServiceError }> {
  // Check owner access
  const accessCheck = await checkOwnerAccess(meetingId, addedByUserId);
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

  try {
    // Verify meeting exists
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      select: { id: true, ownerUserId: true },
    });

    if (!meeting) {
      return {
        error: {
          code: MEETING_ERROR_CODES.MEETING_NOT_FOUND,
          message: MEETING_ERROR_MESSAGES[MEETING_ERROR_CODES.MEETING_NOT_FOUND],
        },
      };
    }

    // Cannot add owner as viewer
    if (userId === meeting.ownerUserId) {
      return {
        error: {
          code: MEETING_ERROR_CODES.VIEWER_ALREADY_EXISTS,
          message: 'Cannot add meeting owner as viewer',
        },
      };
    }

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true },
    });

    if (!user) {
      return {
        error: {
          code: MEETING_ERROR_CODES.USER_NOT_FOUND,
          message: MEETING_ERROR_MESSAGES[MEETING_ERROR_CODES.USER_NOT_FOUND],
        },
      };
    }

    // Get added by user info
    const addedByUser = await prisma.user.findUnique({
      where: { id: addedByUserId },
      select: { name: true },
    });

    // Create viewer
    const viewer = await prisma.meetingViewer.upsert({
      where: {
        meetingId_userId: {
          meetingId,
          userId,
        },
      },
      create: {
        meetingId,
        userId,
        addedByUserId,
      },
      update: {
        addedByUserId,
      },
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
    });

    return {
      data: {
        userId: viewer.userId,
        userName: viewer.user.name,
        addedAt: viewer.addedAt.toISOString(),
        addedByUserId: viewer.addedByUserId,
        addedByName: viewer.addedByUser.name,
      },
    };
  } catch (error) {
    // Handle unique constraint violation
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return {
        error: {
          code: MEETING_ERROR_CODES.VIEWER_ALREADY_EXISTS,
          message: MEETING_ERROR_MESSAGES[MEETING_ERROR_CODES.VIEWER_ALREADY_EXISTS],
        },
      };
    }

    return {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to add viewer',
        details: { originalError: error instanceof Error ? error.message : 'Unknown error' },
      },
    };
  }
}

/**
 * Remove viewer from meeting (only owner can do this)
 */
export async function removeViewer(
  meetingId: string,
  userId: string,
  removedByUserId: string
): Promise<{ success: true } | { error: ViewersServiceError }> {
  // Check owner access
  const accessCheck = await checkOwnerAccess(meetingId, removedByUserId);
  if (!accessCheck.allowed) {
    return {
      error: {
        code: accessCheck.error!.code,
        message: accessCheck.error!.message,
      },
    };
  }

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
    await prisma.meetingViewer.delete({
      where: {
        meetingId_userId: {
          meetingId,
          userId,
        },
      },
    });

    return { success: true };
  } catch (error) {
    return {
      error: {
        code: MEETING_ERROR_CODES.VIEWER_NOT_FOUND,
        message: MEETING_ERROR_MESSAGES[MEETING_ERROR_CODES.VIEWER_NOT_FOUND],
      },
    };
  }
}

/**
 * Get meeting viewers
 */
export async function getMeetingViewers(
  meetingId: string
): Promise<{ data: MeetingViewerResponse[] } | { error: ViewersServiceError }> {
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
    const viewers = await prisma.meetingViewer.findMany({
      where: { meetingId },
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
      orderBy: {
        addedAt: 'asc',
      },
    });

    return {
      data: viewers.map((v) => ({
        userId: v.userId,
        userName: v.user.name,
        addedAt: v.addedAt.toISOString(),
        addedByUserId: v.addedByUserId,
        addedByName: v.addedByUser.name,
      })),
    };
  } catch (error) {
    return {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch viewers',
        details: { originalError: error instanceof Error ? error.message : 'Unknown error' },
      },
    };
  }
}

/**
 * Transfer ownership to another user (only owner can do this)
 */
export async function transferOwnership(
  meetingId: string,
  data: TransferOwnershipRequest,
  currentOwnerUserId: string
): Promise<{ success: true } | { error: ViewersServiceError }> {
  // Check owner access
  const accessCheck = await checkOwnerAccess(meetingId, currentOwnerUserId);
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

  // Cannot transfer to self
  if (data.newOwnerUserId === currentOwnerUserId) {
    return {
      error: {
        code: MEETING_ERROR_CODES.CANNOT_TRANSFER_TO_SELF,
        message: MEETING_ERROR_MESSAGES[MEETING_ERROR_CODES.CANNOT_TRANSFER_TO_SELF],
      },
    };
  }

  try {
    // Verify meeting exists
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      select: { id: true, ownerUserId: true },
    });

    if (!meeting) {
      return {
        error: {
          code: MEETING_ERROR_CODES.MEETING_NOT_FOUND,
          message: MEETING_ERROR_MESSAGES[MEETING_ERROR_CODES.MEETING_NOT_FOUND],
        },
      };
    }

    // Verify new owner exists
    const newOwner = await prisma.user.findUnique({
      where: { id: data.newOwnerUserId },
      select: { id: true },
    });

    if (!newOwner) {
      return {
        error: {
          code: MEETING_ERROR_CODES.USER_NOT_FOUND,
          message: MEETING_ERROR_MESSAGES[MEETING_ERROR_CODES.USER_NOT_FOUND],
        },
      };
    }

    // Transfer ownership in transaction
    await prisma.$transaction(async (tx) => {
      // Update meeting owner
      await tx.meeting.update({
        where: { id: meetingId },
        data: {
          ownerUserId: data.newOwnerUserId,
        },
      });

      // Remove new owner from viewers if exists
      await tx.meetingViewer.deleteMany({
        where: {
          meetingId,
          userId: data.newOwnerUserId,
        },
      });
    });

    return { success: true };
  } catch (error) {
    return {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to transfer ownership',
        details: { originalError: error instanceof Error ? error.message : 'Unknown error' },
      },
    };
  }
}








