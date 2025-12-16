/**
 * Validation Error Class
 * For data validation failures
 */

import { BaseError } from './base-error';

export class ValidationError extends BaseError {
  constructor(
    message: string,
    details?: Record<string, unknown>,
    code: string = 'VALIDATION_ERROR'
  ) {
    super(code, message, details, true);
  }
}

