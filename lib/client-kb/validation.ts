/**
 * Client KB Module Validation
 * Validation functions for client data
 */

import { CLIENT_KB_ERROR_CODES, CLIENT_KB_ERROR_MESSAGES, CLIENT_KB_CONSTANTS } from './constants';

export interface ValidationResult {
  valid: boolean;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Validate client name
 */
export function validateClientName(name: unknown): ValidationResult {
  if (typeof name !== 'string') {
    return {
      valid: false,
      error: {
        code: CLIENT_KB_ERROR_CODES.CLIENT_NAME_REQUIRED,
        message: CLIENT_KB_ERROR_MESSAGES[CLIENT_KB_ERROR_CODES.CLIENT_NAME_REQUIRED],
      },
    };
  }

  const trimmedName = name.trim();

  if (trimmedName.length < CLIENT_KB_CONSTANTS.MIN_NAME_LENGTH) {
    return {
      valid: false,
      error: {
        code: CLIENT_KB_ERROR_CODES.CLIENT_NAME_REQUIRED,
        message: CLIENT_KB_ERROR_MESSAGES[CLIENT_KB_ERROR_CODES.CLIENT_NAME_REQUIRED],
      },
    };
  }

  if (trimmedName.length > CLIENT_KB_CONSTANTS.MAX_NAME_LENGTH) {
    return {
      valid: false,
      error: {
        code: CLIENT_KB_ERROR_CODES.CLIENT_NAME_TOO_LONG,
        message: CLIENT_KB_ERROR_MESSAGES[CLIENT_KB_ERROR_CODES.CLIENT_NAME_TOO_LONG],
      },
    };
  }

  return { valid: true };
}

/**
 * Validate client ID format (short ID: prefix + number)
 * Format: {prefix}{number} (e.g., "cli1", "cli42")
 */
export function validateClientId(clientId: unknown): ValidationResult {
  if (typeof clientId !== 'string') {
    return {
      valid: false,
      error: {
        code: CLIENT_KB_ERROR_CODES.INVALID_CLIENT_ID,
        message: CLIENT_KB_ERROR_MESSAGES[CLIENT_KB_ERROR_CODES.INVALID_CLIENT_ID],
      },
    };
  }

  // Short ID format validation: 3 letters + 1+ digits
  const shortIdRegex = /^[a-z]{3}\d+$/i;
  
  if (!shortIdRegex.test(clientId)) {
    return {
      valid: false,
      error: {
        code: CLIENT_KB_ERROR_CODES.INVALID_CLIENT_ID,
        message: CLIENT_KB_ERROR_MESSAGES[CLIENT_KB_ERROR_CODES.INVALID_CLIENT_ID],
      },
    };
  }

  // Check if prefix matches expected prefix for clients
  if (!clientId.toLowerCase().startsWith('cli')) {
    return {
      valid: false,
      error: {
        code: CLIENT_KB_ERROR_CODES.INVALID_CLIENT_ID,
        message: CLIENT_KB_ERROR_MESSAGES[CLIENT_KB_ERROR_CODES.INVALID_CLIENT_ID],
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
  const pageSize = params.pageSize !== undefined ? Number(params.pageSize) : CLIENT_KB_CONSTANTS.DEFAULT_PAGE_SIZE;

  if (isNaN(page) || page < 1) {
    return {
      valid: false,
      page: 1,
      pageSize: CLIENT_KB_CONSTANTS.DEFAULT_PAGE_SIZE,
      error: {
        code: 'INVALID_PAGE',
        message: 'Page must be a positive integer',
      },
    };
  }

  if (isNaN(pageSize) || pageSize < 1 || pageSize > CLIENT_KB_CONSTANTS.MAX_PAGE_SIZE) {
    return {
      valid: false,
      page,
      pageSize: CLIENT_KB_CONSTANTS.DEFAULT_PAGE_SIZE,
      error: {
        code: 'INVALID_PAGE_SIZE',
        message: `Page size must be between 1 and ${CLIENT_KB_CONSTANTS.MAX_PAGE_SIZE}`,
      },
    };
  }

  return {
    valid: true,
    page,
    pageSize,
  };
}








