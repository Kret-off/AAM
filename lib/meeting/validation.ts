/**
 * Meeting Module Validation
 * Validation functions for meeting data
 */

import { MeetingStatus, ValidationDecision } from '@prisma/client';
import {
  MEETING_ERROR_CODES,
  MEETING_ERROR_MESSAGES,
  MEETING_CONSTANTS,
  VALID_STATUS_TRANSITIONS,
  VALIDATION_ALLOWED_STATUSES,
} from './constants';

export interface ValidationResult {
  valid: boolean;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Validate meeting ID format (short ID: prefix + number)
 * Format: {prefix}{number} (e.g., "met1", "met42")
 */
export function validateMeetingId(meetingId: unknown): ValidationResult {
  if (typeof meetingId !== 'string') {
    return {
      valid: false,
      error: {
        code: MEETING_ERROR_CODES.INVALID_MEETING_ID,
        message: MEETING_ERROR_MESSAGES[MEETING_ERROR_CODES.INVALID_MEETING_ID],
      },
    };
  }

  // Short ID format validation: 3 letters + 1+ digits
  const shortIdRegex = /^[a-z]{3}\d+$/i;

  if (!shortIdRegex.test(meetingId)) {
    return {
      valid: false,
      error: {
        code: MEETING_ERROR_CODES.INVALID_MEETING_ID,
        message: MEETING_ERROR_MESSAGES[MEETING_ERROR_CODES.INVALID_MEETING_ID],
      },
    };
  }

  // Check if prefix matches expected prefix for meetings
  if (!meetingId.toLowerCase().startsWith('met')) {
    return {
      valid: false,
      error: {
        code: MEETING_ERROR_CODES.INVALID_MEETING_ID,
        message: MEETING_ERROR_MESSAGES[MEETING_ERROR_CODES.INVALID_MEETING_ID],
      },
    };
  }

  return { valid: true };
}

/**
 * Validate status transition
 */
export function validateStatusTransition(
  currentStatus: MeetingStatus,
  newStatus: MeetingStatus
): ValidationResult {
  const allowedTransitions = VALID_STATUS_TRANSITIONS[currentStatus];

  if (!allowedTransitions.includes(newStatus)) {
    return {
      valid: false,
      error: {
        code: MEETING_ERROR_CODES.INVALID_STATUS_TRANSITION,
        message: `${MEETING_ERROR_MESSAGES[MEETING_ERROR_CODES.INVALID_STATUS_TRANSITION]}: Cannot transition from ${currentStatus} to ${newStatus}`,
      },
    };
  }

  return { valid: true };
}

/**
 * Validate that meeting is ready for validation
 */
export function validateCanValidate(status: MeetingStatus): ValidationResult {
  if (!VALIDATION_ALLOWED_STATUSES.includes(status)) {
    return {
      valid: false,
      error: {
        code: MEETING_ERROR_CODES.MEETING_NOT_READY,
        message: `${MEETING_ERROR_MESSAGES[MEETING_ERROR_CODES.MEETING_NOT_READY]}: Current status is ${status}`,
      },
    };
  }

  return { valid: true };
}

/**
 * Validate validation decision
 */
export function validateValidationDecision(decision: unknown): ValidationResult {
  if (decision !== 'accepted' && decision !== 'rejected') {
    return {
      valid: false,
      error: {
        code: MEETING_ERROR_CODES.INVALID_VALIDATION_DECISION,
        message: MEETING_ERROR_MESSAGES[MEETING_ERROR_CODES.INVALID_VALIDATION_DECISION],
      },
    };
  }

  return { valid: true };
}

/**
 * Validate pagination parameters
 */
export function validatePaginationParams(params: {
  page?: unknown;
  pageSize?: unknown;
}): { valid: boolean; page: number; pageSize: number; error?: ValidationResult['error'] } {
  const page = params.page !== undefined ? Number(params.page) : 1;
  const pageSize =
    params.pageSize !== undefined ? Number(params.pageSize) : MEETING_CONSTANTS.DEFAULT_PAGE_SIZE;

  if (isNaN(page) || page < 1) {
    return {
      valid: false,
      page: 1,
      pageSize: MEETING_CONSTANTS.DEFAULT_PAGE_SIZE,
      error: {
        code: 'INVALID_PAGE',
        message: 'Page must be a positive integer',
      },
    };
  }

  if (isNaN(pageSize) || pageSize < 1 || pageSize > MEETING_CONSTANTS.MAX_PAGE_SIZE) {
    return {
      valid: false,
      page,
      pageSize: MEETING_CONSTANTS.DEFAULT_PAGE_SIZE,
      error: {
        code: 'INVALID_PAGE_SIZE',
        message: `Page size must be between 1 and ${MEETING_CONSTANTS.MAX_PAGE_SIZE}`,
      },
    };
  }

  return {
    valid: true,
    page,
    pageSize,
  };
}








