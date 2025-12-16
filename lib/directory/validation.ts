/**
 * Directory Module Validation
 * Validation functions for participant data
 */

import { ParticipantType } from './types';
import {
  DIRECTORY_ERROR_CODES,
  DIRECTORY_ERROR_MESSAGES,
  DIRECTORY_CONSTANTS,
} from './constants';

export interface ValidationResult {
  valid: boolean;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Validate participant full name
 */
export function validateFullName(fullName: unknown): ValidationResult {
  if (typeof fullName !== 'string') {
    return {
      valid: false,
      error: {
        code: DIRECTORY_ERROR_CODES.FULL_NAME_REQUIRED,
        message: DIRECTORY_ERROR_MESSAGES[DIRECTORY_ERROR_CODES.FULL_NAME_REQUIRED],
      },
    };
  }

  const trimmedName = fullName.trim();

  if (trimmedName.length < DIRECTORY_CONSTANTS.MIN_FULL_NAME_LENGTH) {
    return {
      valid: false,
      error: {
        code: DIRECTORY_ERROR_CODES.FULL_NAME_REQUIRED,
        message: DIRECTORY_ERROR_MESSAGES[DIRECTORY_ERROR_CODES.FULL_NAME_REQUIRED],
      },
    };
  }

  if (trimmedName.length > DIRECTORY_CONSTANTS.MAX_FULL_NAME_LENGTH) {
    return {
      valid: false,
      error: {
        code: DIRECTORY_ERROR_CODES.FULL_NAME_TOO_LONG,
        message: DIRECTORY_ERROR_MESSAGES[DIRECTORY_ERROR_CODES.FULL_NAME_TOO_LONG],
      },
    };
  }

  return { valid: true };
}

/**
 * Validate participant type
 */
export function validateParticipantType(type: unknown): ValidationResult {
  if (typeof type !== 'string') {
    return {
      valid: false,
      error: {
        code: DIRECTORY_ERROR_CODES.INVALID_PARTICIPANT_TYPE,
        message: DIRECTORY_ERROR_MESSAGES[DIRECTORY_ERROR_CODES.INVALID_PARTICIPANT_TYPE],
      },
    };
  }

  if (type !== 'internal' && type !== 'external') {
    return {
      valid: false,
      error: {
        code: DIRECTORY_ERROR_CODES.INVALID_PARTICIPANT_TYPE,
        message: DIRECTORY_ERROR_MESSAGES[DIRECTORY_ERROR_CODES.INVALID_PARTICIPANT_TYPE],
      },
    };
  }

  return { valid: true };
}

/**
 * Validate participant data with conditional fields
 */
export function validateParticipantData(
  type: ParticipantType,
  data: {
    companyName?: string | null;
    department?: string | null;
  }
): ValidationResult {
  if (type === 'external' && (!data.companyName || data.companyName.trim().length === 0)) {
    return {
      valid: false,
      error: {
        code: DIRECTORY_ERROR_CODES.COMPANY_NAME_REQUIRED_FOR_EXTERNAL,
        message:
          DIRECTORY_ERROR_MESSAGES[DIRECTORY_ERROR_CODES.COMPANY_NAME_REQUIRED_FOR_EXTERNAL],
      },
    };
  }

  if (type === 'internal' && (!data.department || data.department.trim().length === 0)) {
    return {
      valid: false,
      error: {
        code: DIRECTORY_ERROR_CODES.DEPARTMENT_REQUIRED_FOR_INTERNAL,
        message:
          DIRECTORY_ERROR_MESSAGES[DIRECTORY_ERROR_CODES.DEPARTMENT_REQUIRED_FOR_INTERNAL],
      },
    };
  }

  return { valid: true };
}

/**
 * Validate tags format (must be JSON-serializable object or array)
 */
export function validateTags(tags: unknown): ValidationResult {
  if (tags === null || tags === undefined) {
    return { valid: true };
  }

  if (typeof tags === 'object' && (Array.isArray(tags) || !Array.isArray(tags))) {
    // Try to serialize to ensure it's valid JSON
    try {
      JSON.stringify(tags);
      return { valid: true };
    } catch {
      return {
        valid: false,
        error: {
          code: DIRECTORY_ERROR_CODES.INVALID_TAGS_FORMAT,
          message: DIRECTORY_ERROR_MESSAGES[DIRECTORY_ERROR_CODES.INVALID_TAGS_FORMAT],
        },
      };
    }
  }

  return {
    valid: false,
    error: {
      code: DIRECTORY_ERROR_CODES.INVALID_TAGS_FORMAT,
      message: DIRECTORY_ERROR_MESSAGES[DIRECTORY_ERROR_CODES.INVALID_TAGS_FORMAT],
    },
  };
}

/**
 * Validate participant ID format (short ID: prefix + number)
 * Format: {prefix}{number} (e.g., "par1", "par42")
 */
export function validateParticipantId(participantId: unknown): ValidationResult {
  if (typeof participantId !== 'string') {
    return {
      valid: false,
      error: {
        code: DIRECTORY_ERROR_CODES.INVALID_PARTICIPANT_ID,
        message: DIRECTORY_ERROR_MESSAGES[DIRECTORY_ERROR_CODES.INVALID_PARTICIPANT_ID],
      },
    };
  }

  // Short ID format validation: 3 letters + 1+ digits
  const shortIdRegex = /^[a-z]{3}\d+$/i;

  if (!shortIdRegex.test(participantId)) {
    return {
      valid: false,
      error: {
        code: DIRECTORY_ERROR_CODES.INVALID_PARTICIPANT_ID,
        message: DIRECTORY_ERROR_MESSAGES[DIRECTORY_ERROR_CODES.INVALID_PARTICIPANT_ID],
      },
    };
  }

  // Check if prefix matches expected prefix for participants
  if (!participantId.toLowerCase().startsWith('par')) {
    return {
      valid: false,
      error: {
        code: DIRECTORY_ERROR_CODES.INVALID_PARTICIPANT_ID,
        message: DIRECTORY_ERROR_MESSAGES[DIRECTORY_ERROR_CODES.INVALID_PARTICIPANT_ID],
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
    params.pageSize !== undefined ? Number(params.pageSize) : DIRECTORY_CONSTANTS.DEFAULT_PAGE_SIZE;

  if (isNaN(page) || page < 1) {
    return {
      valid: false,
      page: 1,
      pageSize: DIRECTORY_CONSTANTS.DEFAULT_PAGE_SIZE,
      error: {
        code: 'INVALID_PAGE',
        message: 'Page must be a positive integer',
      },
    };
  }

  if (isNaN(pageSize) || pageSize < 1 || pageSize > DIRECTORY_CONSTANTS.MAX_PAGE_SIZE) {
    return {
      valid: false,
      page,
      pageSize: DIRECTORY_CONSTANTS.DEFAULT_PAGE_SIZE,
      error: {
        code: 'INVALID_PAGE_SIZE',
        message: `Page size must be between 1 and ${DIRECTORY_CONSTANTS.MAX_PAGE_SIZE}`,
      },
    };
  }

  return {
    valid: true,
    page,
    pageSize,
  };
}








