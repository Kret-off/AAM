/**
 * API Error Class
 * For errors that should be returned to the client
 */

import { BaseError } from './base-error';

export class ApiError extends BaseError {
  public readonly statusCode: number;

  constructor(
    code: string,
    message: string,
    statusCode: number = 500,
    details?: Record<string, unknown>
  ) {
    super(code, message, details, true);
    this.statusCode = statusCode;
  }

  static badRequest(message: string, details?: Record<string, unknown>, code: string = 'BAD_REQUEST') {
    return new ApiError(code, message, 400, details);
  }

  static unauthorized(message: string = 'Authentication required', code: string = 'UNAUTHORIZED') {
    return new ApiError(code, message, 401);
  }

  static forbidden(message: string = 'Access denied', code: string = 'FORBIDDEN') {
    return new ApiError(code, message, 403);
  }

  static notFound(message: string = 'Resource not found', code: string = 'NOT_FOUND') {
    return new ApiError(code, message, 404);
  }

  static conflict(message: string, code: string = 'CONFLICT') {
    return new ApiError(code, message, 409);
  }

  static internal(message: string = 'Internal server error', details?: Record<string, unknown>) {
    return new ApiError('INTERNAL_ERROR', message, 500, details);
  }
}

