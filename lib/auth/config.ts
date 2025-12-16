/**
 * Auth Module Configuration
 * Centralized configuration for authentication settings
 */

import { AuthConfig, CookieSameSite } from './types';
import { AUTH_COOKIE_NAME } from './constants';

/**
 * Get session configuration from environment variables
 */
function getSessionConfig(): AuthConfig['session'] {
  const isProduction = process.env.NODE_ENV === 'production';
  const maxAge = parseInt(process.env.AUTH_SESSION_MAX_AGE || '86400', 10); // Default: 24 hours
  const cookieName = process.env.AUTH_COOKIE_NAME || AUTH_COOKIE_NAME;
  
  // Determine sameSite based on environment
  const sameSite: CookieSameSite = 
    process.env.AUTH_COOKIE_SAME_SITE === 'none' ? 'none' :
    process.env.AUTH_COOKIE_SAME_SITE === 'lax' ? 'lax' :
    'strict';

  return {
    maxAge,
    cookieName,
    cookieOptions: {
      httpOnly: true, // Always httpOnly for security
      secure: isProduction || process.env.AUTH_COOKIE_SECURE === 'true', // Secure in production
      sameSite,
      path: process.env.AUTH_COOKIE_PATH || '/',
    },
  };
}

/**
 * Get password configuration
 */
function getPasswordConfig(): AuthConfig['password'] {
  const minLength = parseInt(process.env.AUTH_PASSWORD_MIN_LENGTH || '8', 10);
  const bcryptRounds = parseInt(process.env.AUTH_BCRYPT_ROUNDS || '10', 10);

  return {
    minLength,
    requireUppercase: process.env.AUTH_PASSWORD_REQUIRE_UPPERCASE !== 'false',
    requireLowercase: process.env.AUTH_PASSWORD_REQUIRE_LOWERCASE !== 'false',
    requireNumbers: process.env.AUTH_PASSWORD_REQUIRE_NUMBERS !== 'false',
    requireSpecialChars: process.env.AUTH_PASSWORD_REQUIRE_SPECIAL === 'true',
    bcryptRounds: Math.max(10, Math.min(15, bcryptRounds)), // Clamp between 10-15 for security/performance
  };
}

/**
 * Get email configuration
 */
function getEmailConfig(): AuthConfig['email'] {
  const maxLength = parseInt(process.env.AUTH_EMAIL_MAX_LENGTH || '255', 10);
  // Standard email regex pattern
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  return {
    maxLength,
    validationRegex: emailRegex,
  };
}

/**
 * Get JWT secret (required for session token generation)
 */
function getJWTSecret(): string {
  const secret = process.env.AUTH_JWT_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error(
      'AUTH_JWT_SECRET or NEXTAUTH_SECRET environment variable is required'
    );
  }
  return secret;
}

/**
 * Main auth configuration object
 */
export const authConfig: AuthConfig = {
  session: getSessionConfig(),
  password: getPasswordConfig(),
  email: getEmailConfig(),
  jwtSecret: getJWTSecret(),
};

/**
 * Validate password against configuration rules
 */
export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const config = authConfig.password;
  const errors: string[] = [];

  if (password.length < config.minLength) {
    errors.push(`Password must be at least ${config.minLength} characters long`);
  }

  if (config.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (config.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (config.requireNumbers && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (config.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate email against configuration rules
 */
export function validateEmail(email: string): { valid: boolean; error?: string } {
  const config = authConfig.email;

  if (email.length > config.maxLength) {
    return {
      valid: false,
      error: `Email must be no more than ${config.maxLength} characters`,
    };
  }

  if (!config.validationRegex.test(email)) {
    return {
      valid: false,
      error: 'Invalid email format',
    };
  }

  return { valid: true };
}








