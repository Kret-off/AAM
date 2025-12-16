/**
 * Upload Module Validation
 * Validation functions for file uploads
 */

import {
  UPLOAD_CONSTANTS,
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
  UPLOAD_ERROR_CODES,
  UPLOAD_ERROR_MESSAGES,
} from './constants';

export interface ValidationResult {
  valid: boolean;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Validate file size
 */
export function validateFileSize(sizeBytes: number): ValidationResult {
  if (typeof sizeBytes !== 'number' || sizeBytes <= 0) {
    return {
      valid: false,
      error: {
        code: UPLOAD_ERROR_CODES.INVALID_FILE_SIZE,
        message: UPLOAD_ERROR_MESSAGES[UPLOAD_ERROR_CODES.INVALID_FILE_SIZE],
      },
    };
  }

  if (sizeBytes > UPLOAD_CONSTANTS.MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: {
        code: UPLOAD_ERROR_CODES.FILE_TOO_LARGE,
        message: UPLOAD_ERROR_MESSAGES[UPLOAD_ERROR_CODES.FILE_TOO_LARGE],
      },
    };
  }

  return { valid: true };
}

/**
 * Validate MIME type
 */
export function validateMimeType(mimeType: string): ValidationResult {
  if (typeof mimeType !== 'string' || !mimeType.trim()) {
    return {
      valid: false,
      error: {
        code: UPLOAD_ERROR_CODES.INVALID_MIME_TYPE,
        message: UPLOAD_ERROR_MESSAGES[UPLOAD_ERROR_CODES.INVALID_MIME_TYPE],
      },
    };
  }

  if (!ALLOWED_MIME_TYPES.includes(mimeType as (typeof ALLOWED_MIME_TYPES)[number])) {
    return {
      valid: false,
      error: {
        code: UPLOAD_ERROR_CODES.INVALID_MIME_TYPE,
        message: UPLOAD_ERROR_MESSAGES[UPLOAD_ERROR_CODES.INVALID_MIME_TYPE],
      },
    };
  }

  return { valid: true };
}

/**
 * Validate file extension
 */
export function validateFileExtension(fileName: string): ValidationResult {
  if (typeof fileName !== 'string' || !fileName.trim()) {
    return {
      valid: false,
      error: {
        code: UPLOAD_ERROR_CODES.INVALID_FILE_NAME,
        message: UPLOAD_ERROR_MESSAGES[UPLOAD_ERROR_CODES.INVALID_FILE_NAME],
      },
    };
  }

  const extension = fileName.split('.').pop()?.toLowerCase();
  if (!extension) {
    return {
      valid: false,
      error: {
        code: UPLOAD_ERROR_CODES.INVALID_FILE_EXTENSION,
        message: UPLOAD_ERROR_MESSAGES[UPLOAD_ERROR_CODES.INVALID_FILE_EXTENSION],
      },
    };
  }

  if (!ALLOWED_EXTENSIONS.includes(extension as (typeof ALLOWED_EXTENSIONS)[number])) {
    return {
      valid: false,
      error: {
        code: UPLOAD_ERROR_CODES.INVALID_FILE_EXTENSION,
        message: UPLOAD_ERROR_MESSAGES[UPLOAD_ERROR_CODES.INVALID_FILE_EXTENSION],
      },
    };
  }

  return { valid: true };
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
        code: UPLOAD_ERROR_CODES.INVALID_MEETING_ID,
        message: UPLOAD_ERROR_MESSAGES[UPLOAD_ERROR_CODES.INVALID_MEETING_ID],
      },
    };
  }

  // Short ID format validation: 3 letters + 1+ digits
  const shortIdRegex = /^[a-z]{3}\d+$/i;

  if (!shortIdRegex.test(meetingId)) {
    return {
      valid: false,
      error: {
        code: UPLOAD_ERROR_CODES.INVALID_MEETING_ID,
        message: UPLOAD_ERROR_MESSAGES[UPLOAD_ERROR_CODES.INVALID_MEETING_ID],
      },
    };
  }

  // Check if prefix matches expected prefix for meetings
  if (!meetingId.toLowerCase().startsWith('met')) {
    return {
      valid: false,
      error: {
        code: UPLOAD_ERROR_CODES.INVALID_MEETING_ID,
        message: UPLOAD_ERROR_MESSAGES[UPLOAD_ERROR_CODES.INVALID_MEETING_ID],
      },
    };
  }

  return { valid: true };
}

/**
 * Validate complete file upload request
 */
export function validateFileUpload(
  fileName: string,
  fileSize: number,
  mimeType: string
): ValidationResult {
  // Validate file name
  const fileNameValidation = validateFileExtension(fileName);
  if (!fileNameValidation.valid) {
    return fileNameValidation;
  }

  // Validate file size
  const sizeValidation = validateFileSize(fileSize);
  if (!sizeValidation.valid) {
    return sizeValidation;
  }

  // Validate MIME type
  const mimeValidation = validateMimeType(mimeType);
  if (!mimeValidation.valid) {
    return mimeValidation;
  }

  return { valid: true };
}








