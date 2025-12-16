/**
 * API Response Utilities
 * Standardized response helpers for API routes
 */

import { NextResponse } from 'next/server';
import { ApiError as ApiErrorClass } from '../errors/api-error';

/**
 * Error response structure
 */
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Success response structure
 */
export interface ApiSuccess<T = unknown> {
  data: T;
}

/**
 * Create standardized error response
 * 
 * @param code - Error code
 * @param message - Error message
 * @param status - HTTP status code
 * @param details - Optional error details
 * @returns NextResponse with error
 */
export function createErrorResponse(
  code: string,
  message: string,
  status: number = 500,
  details?: Record<string, unknown>
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(details && { details }),
      },
    },
    { status }
  );
}

/**
 * Create error response from error object
 * 
 * @param error - Error object
 * @returns NextResponse with error
 */
export function createErrorResponseFromError(error: unknown): NextResponse<ApiErrorResponse> {
  if (error instanceof ApiErrorClass) {
    return createErrorResponse(
      error.code,
      error.message,
      error.statusCode,
      error.details
    );
  }

  if (error instanceof Error) {
    return createErrorResponse(
      'INTERNAL_ERROR',
      error.message,
      500,
      { originalError: error.message }
    );
  }

  return createErrorResponse(
    'INTERNAL_ERROR',
    'Unknown error occurred',
    500
  );
}

/**
 * Create standardized success response
 * 
 * @param data - Response data
 * @param status - HTTP status code (default: 200)
 * @returns NextResponse with data
 */
export function createSuccessResponse<T>(
  data: T,
  status: number = 200
): NextResponse<ApiSuccess<T>> {
  return NextResponse.json(
    {
      data,
    },
    { status }
  );
}

/**
 * Create created response (201)
 * 
 * @param data - Response data
 * @returns NextResponse with data
 */
export function createCreatedResponse<T>(
  data: T
): NextResponse<ApiSuccess<T>> {
  return createSuccessResponse(data, 201);
}

/**
 * Common HTTP error responses
 */
export const CommonErrors = {
  /**
   * 400 Bad Request
   */
  badRequest: (message: string, details?: Record<string, unknown>) =>
    createErrorResponse('INVALID_REQUEST', message, 400, details),

  /**
   * 401 Unauthorized
   */
  unauthorized: (message: string = 'Authentication required') =>
    createErrorResponse('UNAUTHORIZED', message, 401),

  /**
   * 403 Forbidden
   */
  forbidden: (message: string = 'Access denied') =>
    createErrorResponse('FORBIDDEN', message, 403),

  /**
   * 404 Not Found
   */
  notFound: (resource: string = 'Resource') =>
    createErrorResponse('NOT_FOUND', `${resource} not found`, 404),

  /**
   * 409 Conflict
   */
  conflict: (message: string) =>
    createErrorResponse('CONFLICT', message, 409),

  /**
   * 500 Internal Server Error
   */
  internal: (message: string = 'Internal server error', details?: Record<string, unknown>) =>
    createErrorResponse('INTERNAL_ERROR', message, 500, details),
};

