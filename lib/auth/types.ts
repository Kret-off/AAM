/**
 * Auth Module Types
 * Type definitions for authentication configuration and responses
 */

export type CookieSameSite = 'strict' | 'lax' | 'none';

export interface SessionConfig {
  maxAge: number; // in seconds
  cookieName: string;
  cookieOptions: {
    httpOnly: boolean;
    secure: boolean;
    sameSite: CookieSameSite;
    path: string;
  };
}

export interface PasswordConfig {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  bcryptRounds: number;
}

export interface EmailConfig {
  maxLength: number;
  validationRegex: RegExp;
}

export interface AuthConfig {
  session: SessionConfig;
  password: PasswordConfig;
  email: EmailConfig;
  jwtSecret: string;
}

export interface AuthError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}








