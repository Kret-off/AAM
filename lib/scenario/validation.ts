/**
 * Scenario Module Validation
 * Validation functions for scenario data
 */

import {
  SCENARIO_ERROR_CODES,
  SCENARIO_ERROR_MESSAGES,
  SCENARIO_CONSTANTS,
} from './constants';

export interface ValidationResult {
  valid: boolean;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Validate scenario ID format (short ID: prefix + number)
 * Format: {prefix}{number} (e.g., "scn1", "scn42")
 */
export function validateScenarioId(scenarioId: unknown): ValidationResult {
  if (typeof scenarioId !== 'string') {
    return {
      valid: false,
      error: {
        code: SCENARIO_ERROR_CODES.INVALID_SCENARIO_ID,
        message: SCENARIO_ERROR_MESSAGES[SCENARIO_ERROR_CODES.INVALID_SCENARIO_ID],
      },
    };
  }

  // Short ID format validation: 3 letters + 1+ digits
  const shortIdRegex = /^[a-z]{3}\d+$/i;

  if (!shortIdRegex.test(scenarioId)) {
    return {
      valid: false,
      error: {
        code: SCENARIO_ERROR_CODES.INVALID_SCENARIO_ID,
        message: SCENARIO_ERROR_MESSAGES[SCENARIO_ERROR_CODES.INVALID_SCENARIO_ID],
      },
    };
  }

  // Check if prefix matches expected prefix for scenarios
  if (!scenarioId.toLowerCase().startsWith('scn')) {
    return {
      valid: false,
      error: {
        code: SCENARIO_ERROR_CODES.INVALID_SCENARIO_ID,
        message: SCENARIO_ERROR_MESSAGES[SCENARIO_ERROR_CODES.INVALID_SCENARIO_ID],
      },
    };
  }

  return { valid: true };
}

/**
 * Validate meeting type ID format (short ID: prefix + number)
 * Format: {prefix}{number} (e.g., "mty1", "mty42")
 */
export function validateMeetingTypeId(meetingTypeId: unknown): ValidationResult {
  if (typeof meetingTypeId !== 'string') {
    return {
      valid: false,
      error: {
        code: SCENARIO_ERROR_CODES.INVALID_MEETING_TYPE_ID,
        message: SCENARIO_ERROR_MESSAGES[SCENARIO_ERROR_CODES.INVALID_MEETING_TYPE_ID],
      },
    };
  }

  // Short ID format validation: 3 letters + 1+ digits
  const shortIdRegex = /^[a-z]{3}\d+$/i;

  if (!shortIdRegex.test(meetingTypeId)) {
    return {
      valid: false,
      error: {
        code: SCENARIO_ERROR_CODES.INVALID_MEETING_TYPE_ID,
        message: SCENARIO_ERROR_MESSAGES[SCENARIO_ERROR_CODES.INVALID_MEETING_TYPE_ID],
      },
    };
  }

  // Check if prefix matches expected prefix for meeting types
  if (!meetingTypeId.toLowerCase().startsWith('mty')) {
    return {
      valid: false,
      error: {
        code: SCENARIO_ERROR_CODES.INVALID_MEETING_TYPE_ID,
        message: SCENARIO_ERROR_MESSAGES[SCENARIO_ERROR_CODES.INVALID_MEETING_TYPE_ID],
      },
    };
  }

  return { valid: true };
}

/**
 * Validate scenario name
 */
export function validateScenarioName(name: unknown): ValidationResult {
  if (typeof name !== 'string') {
    return {
      valid: false,
      error: {
        code: SCENARIO_ERROR_CODES.NAME_REQUIRED,
        message: SCENARIO_ERROR_MESSAGES[SCENARIO_ERROR_CODES.NAME_REQUIRED],
      },
    };
  }

  const trimmedName = name.trim();

  if (trimmedName.length < SCENARIO_CONSTANTS.MIN_NAME_LENGTH) {
    return {
      valid: false,
      error: {
        code: SCENARIO_ERROR_CODES.NAME_REQUIRED,
        message: SCENARIO_ERROR_MESSAGES[SCENARIO_ERROR_CODES.NAME_REQUIRED],
      },
    };
  }

  if (trimmedName.length > SCENARIO_CONSTANTS.MAX_NAME_LENGTH) {
    return {
      valid: false,
      error: {
        code: SCENARIO_ERROR_CODES.NAME_TOO_LONG,
        message: SCENARIO_ERROR_MESSAGES[SCENARIO_ERROR_CODES.NAME_TOO_LONG],
      },
    };
  }

  return { valid: true };
}

/**
 * Validate meeting type name
 */
export function validateMeetingTypeName(name: unknown): ValidationResult {
  if (typeof name !== 'string') {
    return {
      valid: false,
      error: {
        code: SCENARIO_ERROR_CODES.MEETING_TYPE_NAME_REQUIRED,
        message: SCENARIO_ERROR_MESSAGES[SCENARIO_ERROR_CODES.MEETING_TYPE_NAME_REQUIRED],
      },
    };
  }

  const trimmedName = name.trim();

  if (trimmedName.length < SCENARIO_CONSTANTS.MIN_NAME_LENGTH) {
    return {
      valid: false,
      error: {
        code: SCENARIO_ERROR_CODES.MEETING_TYPE_NAME_REQUIRED,
        message: SCENARIO_ERROR_MESSAGES[SCENARIO_ERROR_CODES.MEETING_TYPE_NAME_REQUIRED],
      },
    };
  }

  if (trimmedName.length > SCENARIO_CONSTANTS.MAX_MEETING_TYPE_NAME_LENGTH) {
    return {
      valid: false,
      error: {
        code: SCENARIO_ERROR_CODES.MEETING_TYPE_NAME_TOO_LONG,
        message: SCENARIO_ERROR_MESSAGES[SCENARIO_ERROR_CODES.MEETING_TYPE_NAME_TOO_LONG],
      },
    };
  }

  return { valid: true };
}

/**
 * Validate system prompt
 */
export function validateSystemPrompt(systemPrompt: unknown): ValidationResult {
  if (typeof systemPrompt !== 'string') {
    return {
      valid: false,
      error: {
        code: SCENARIO_ERROR_CODES.SYSTEM_PROMPT_REQUIRED,
        message: SCENARIO_ERROR_MESSAGES[SCENARIO_ERROR_CODES.SYSTEM_PROMPT_REQUIRED],
      },
    };
  }

  const trimmedPrompt = systemPrompt.trim();

  if (trimmedPrompt.length < SCENARIO_CONSTANTS.MIN_SYSTEM_PROMPT_LENGTH) {
    return {
      valid: false,
      error: {
        code: SCENARIO_ERROR_CODES.SYSTEM_PROMPT_REQUIRED,
        message: SCENARIO_ERROR_MESSAGES[SCENARIO_ERROR_CODES.SYSTEM_PROMPT_REQUIRED],
      },
    };
  }

  if (trimmedPrompt.length > SCENARIO_CONSTANTS.MAX_SYSTEM_PROMPT_LENGTH) {
    return {
      valid: false,
      error: {
        code: SCENARIO_ERROR_CODES.SYSTEM_PROMPT_TOO_LONG,
        message: SCENARIO_ERROR_MESSAGES[SCENARIO_ERROR_CODES.SYSTEM_PROMPT_TOO_LONG],
      },
    };
  }

  return { valid: true };
}

/**
 * Validate JSON schema (outputSchema or artifactsConfig)
 */
export function validateJSONSchema(schema: unknown, fieldName: 'outputSchema' | 'artifactsConfig'): ValidationResult {
  if (schema === null || schema === undefined) {
    const errorCode = fieldName === 'outputSchema' 
      ? SCENARIO_ERROR_CODES.OUTPUT_SCHEMA_REQUIRED
      : SCENARIO_ERROR_CODES.ARTIFACTS_CONFIG_REQUIRED;
    return {
      valid: false,
      error: {
        code: errorCode,
        message: SCENARIO_ERROR_MESSAGES[errorCode],
      },
    };
  }

  // Check if it's a valid JSON-serializable object
  if (typeof schema !== 'object') {
    const errorCode = fieldName === 'outputSchema'
      ? SCENARIO_ERROR_CODES.OUTPUT_SCHEMA_INVALID
      : SCENARIO_ERROR_CODES.ARTIFACTS_CONFIG_INVALID;
    return {
      valid: false,
      error: {
        code: errorCode,
        message: SCENARIO_ERROR_MESSAGES[errorCode],
      },
    };
  }

  // Try to serialize to ensure it's valid JSON
  try {
    JSON.stringify(schema);
    return { valid: true };
  } catch {
    const errorCode = fieldName === 'outputSchema'
      ? SCENARIO_ERROR_CODES.OUTPUT_SCHEMA_INVALID
      : SCENARIO_ERROR_CODES.ARTIFACTS_CONFIG_INVALID;
    return {
      valid: false,
      error: {
        code: errorCode,
        message: SCENARIO_ERROR_MESSAGES[errorCode],
      },
    };
  }
}

/**
 * Validate keyterms array
 */
export function validateKeyterms(keyterms: unknown): ValidationResult {
  // keyterms is optional, so undefined/null is valid
  if (keyterms === undefined || keyterms === null) {
    return { valid: true };
  }

  // Must be an array
  if (!Array.isArray(keyterms)) {
    return {
      valid: false,
      error: {
        code: SCENARIO_ERROR_CODES.KEYTERMS_INVALID,
        message: SCENARIO_ERROR_MESSAGES[SCENARIO_ERROR_CODES.KEYTERMS_INVALID],
      },
    };
  }

  // Check count limit
  if (keyterms.length > SCENARIO_CONSTANTS.MAX_KEYTERMS_COUNT) {
    return {
      valid: false,
      error: {
        code: SCENARIO_ERROR_CODES.KEYTERMS_TOO_MANY,
        message: SCENARIO_ERROR_MESSAGES[SCENARIO_ERROR_CODES.KEYTERMS_TOO_MANY],
      },
    };
  }

  // Validate each keyterm
  const processedKeyterms: string[] = [];
  for (let i = 0; i < keyterms.length; i++) {
    const keyterm = keyterms[i];

    // Each item must be a string
    if (typeof keyterm !== 'string') {
      return {
        valid: false,
        error: {
          code: SCENARIO_ERROR_CODES.KEYTERMS_INVALID,
          message: SCENARIO_ERROR_MESSAGES[SCENARIO_ERROR_CODES.KEYTERMS_INVALID],
        },
      };
    }

    const trimmedKeyterm = keyterm.trim();

    // Skip empty strings
    if (trimmedKeyterm.length === 0) {
      continue;
    }

    // Check length limit
    if (trimmedKeyterm.length > SCENARIO_CONSTANTS.MAX_KEYTERM_LENGTH) {
      return {
        valid: false,
        error: {
          code: SCENARIO_ERROR_CODES.KEYTERM_TOO_LONG,
          message: SCENARIO_ERROR_MESSAGES[SCENARIO_ERROR_CODES.KEYTERM_TOO_LONG],
        },
      };
    }

    // Add to processed list (deduplication)
    if (!processedKeyterms.includes(trimmedKeyterm)) {
      processedKeyterms.push(trimmedKeyterm);
    }
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
    params.pageSize !== undefined ? Number(params.pageSize) : SCENARIO_CONSTANTS.DEFAULT_PAGE_SIZE;

  if (isNaN(page) || page < 1) {
    return {
      valid: false,
      page: 1,
      pageSize: SCENARIO_CONSTANTS.DEFAULT_PAGE_SIZE,
      error: {
        code: 'INVALID_PAGE',
        message: 'Page must be a positive integer',
      },
    };
  }

  if (isNaN(pageSize) || pageSize < 1 || pageSize > SCENARIO_CONSTANTS.MAX_PAGE_SIZE) {
    return {
      valid: false,
      page,
      pageSize: SCENARIO_CONSTANTS.DEFAULT_PAGE_SIZE,
      error: {
        code: 'INVALID_PAGE_SIZE',
        message: `Page size must be between 1 and ${SCENARIO_CONSTANTS.MAX_PAGE_SIZE}`,
      },
    };
  }

  return {
    valid: true,
    page,
    pageSize,
  };
}


