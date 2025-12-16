/**
 * JWT Utilities
 * Functions for creating and verifying JWT tokens for authentication
 */

import jwt from 'jsonwebtoken';
import { authConfig } from './config';

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
}

/**
 * Create a JWT token for a user session
 */
export function createToken(payload: JWTPayload): string {
  return jwt.sign(payload, authConfig.jwtSecret, {
    expiresIn: authConfig.session.maxAge,
  });
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, authConfig.jwtSecret) as JWTPayload;
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Extract token from request cookies
 */
export function getTokenFromRequest(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  
  const cookies = cookieHeader.split(';').map(c => c.trim());
  const sessionCookie = cookies.find(c => 
    c.startsWith(`${authConfig.session.cookieName}=`)
  );
  
  if (!sessionCookie) return null;
  
  return sessionCookie.split('=')[1];
}








