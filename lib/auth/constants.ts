/**
 * Auth Module Constants
 * Cookie names, error codes, and error messages
 */

export const AUTH_COOKIE_NAME = 'aam_session';

export const AUTH_ERROR_CODES = {
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  USER_INACTIVE: 'USER_INACTIVE',
  INVALID_EMAIL: 'INVALID_EMAIL',
  WEAK_PASSWORD: 'WEAK_PASSWORD',
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',
  UNAUTHORIZED: 'UNAUTHORIZED',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  INVALID_SESSION: 'INVALID_SESSION',
  PASSWORD_RESET_REQUIRED: 'PASSWORD_RESET_REQUIRED',
} as const;

export const AUTH_ERROR_MESSAGES = {
  [AUTH_ERROR_CODES.INVALID_CREDENTIALS]: 'Invalid email or password',
  [AUTH_ERROR_CODES.USER_NOT_FOUND]: 'User not found',
  [AUTH_ERROR_CODES.USER_INACTIVE]: 'User account is inactive',
  [AUTH_ERROR_CODES.INVALID_EMAIL]: 'Invalid email format',
  [AUTH_ERROR_CODES.WEAK_PASSWORD]: 'Password does not meet requirements',
  [AUTH_ERROR_CODES.EMAIL_ALREADY_EXISTS]: 'Email already registered',
  [AUTH_ERROR_CODES.UNAUTHORIZED]: 'Unauthorized access',
  [AUTH_ERROR_CODES.SESSION_EXPIRED]: 'Session has expired',
  [AUTH_ERROR_CODES.INVALID_SESSION]: 'Invalid session',
  [AUTH_ERROR_CODES.PASSWORD_RESET_REQUIRED]: 'Password reset required',
} as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[keyof typeof AUTH_ERROR_CODES];








