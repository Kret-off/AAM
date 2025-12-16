/**
 * Meeting Module RBAC
 * Access control utilities for meeting operations
 */

import { UserRole } from '@prisma/client';
import { prisma } from '../prisma';
import { MEETING_ERROR_CODES, MEETING_ERROR_MESSAGES } from './constants';
import { validateMeetingId } from './validation';

export interface RBACResult {
  allowed: boolean;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Check if user has read access to meeting
 * Read: owner + viewers + Admin
 */
export async function checkMeetingAccess(
  meetingId: string,
  userId: string,
  userRole: UserRole
): Promise<RBACResult> {
  // Admin has read access to all meetings
  if (userRole === 'ADMIN') {
    return { allowed: true };
  }

  // Validate meeting ID
  const idValidation = validateMeetingId(meetingId);
  if (!idValidation.valid) {
    return {
      allowed: false,
      error: {
        code: idValidation.error!.code,
        message: idValidation.error!.message,
      },
    };
  }

  try {
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      select: {
        ownerUserId: true,
        viewers: {
          where: { userId },
          select: { userId: true },
        },
      },
    });

    if (!meeting) {
      return {
        allowed: false,
        error: {
          code: MEETING_ERROR_CODES.MEETING_NOT_FOUND,
          message: MEETING_ERROR_MESSAGES[MEETING_ERROR_CODES.MEETING_NOT_FOUND],
        },
      };
    }

    // Check if user is owner
    if (meeting.ownerUserId === userId) {
      return { allowed: true };
    }

    // Check if user is viewer
    if (meeting.viewers.length > 0) {
      return { allowed: true };
    }

    return {
      allowed: false,
      error: {
        code: MEETING_ERROR_CODES.UNAUTHORIZED_ACCESS,
        message: MEETING_ERROR_MESSAGES[MEETING_ERROR_CODES.UNAUTHORIZED_ACCESS],
      },
    };
  } catch (error) {
    return {
      allowed: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to check meeting access',
        details: { originalError: error instanceof Error ? error.message : 'Unknown error' },
      },
    };
  }
}

/**
 * Check if user is the owner of the meeting
 * Used for operations that require owner rights
 */
export async function checkOwnerAccess(
  meetingId: string,
  userId: string
): Promise<RBACResult> {
  // Validate meeting ID
  const idValidation = validateMeetingId(meetingId);
  if (!idValidation.valid) {
    return {
      allowed: false,
      error: {
        code: idValidation.error!.code,
        message: idValidation.error!.message,
      },
    };
  }

  try {
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      select: {
        ownerUserId: true,
      },
    });

    if (!meeting) {
      return {
        allowed: false,
        error: {
          code: MEETING_ERROR_CODES.MEETING_NOT_FOUND,
          message: MEETING_ERROR_MESSAGES[MEETING_ERROR_CODES.MEETING_NOT_FOUND],
        },
      };
    }

    if (meeting.ownerUserId !== userId) {
      return {
        allowed: false,
        error: {
          code: MEETING_ERROR_CODES.ONLY_OWNER_CAN_VALIDATE,
          message: MEETING_ERROR_MESSAGES[MEETING_ERROR_CODES.ONLY_OWNER_CAN_VALIDATE],
        },
      };
    }

    return { allowed: true };
  } catch (error) {
    return {
      allowed: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to check owner access',
        details: { originalError: error instanceof Error ? error.message : 'Unknown error' },
      },
    };
  }
}

/**
 * Check if user can validate meeting
 * Validate: ONLY current owner
 */
export async function canValidate(
  meetingId: string,
  userId: string
): Promise<RBACResult> {
  return checkOwnerAccess(meetingId, userId);
}

/**
 * Check if user can share meeting
 * Share/Revoke: ONLY owner
 */
export async function canShare(
  meetingId: string,
  userId: string
): Promise<RBACResult> {
  return checkOwnerAccess(meetingId, userId);
}

/**
 * Check if user can transfer ownership
 * Transfer: ONLY owner
 */
export async function canTransfer(
  meetingId: string,
  userId: string
): Promise<RBACResult> {
  return checkOwnerAccess(meetingId, userId);
}








