/**
 * API Route: Login
 * POST /api/auth/login
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { validateEmail } from '@/lib/auth/config';
import { AUTH_ERROR_CODES, AUTH_ERROR_MESSAGES } from '@/lib/auth/constants';
import { createToken } from '@/lib/auth/jwt';
import { authConfig } from '@/lib/auth/config';
import { createSuccessResponse, createErrorResponse, CommonErrors } from '@/lib/api/response-utils';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // Validate input
    if (!email || !password) {
      return createErrorResponse(
        AUTH_ERROR_CODES.INVALID_CREDENTIALS,
        AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.INVALID_CREDENTIALS],
        400
      );
    }

    // Validate email format
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return createErrorResponse(
        AUTH_ERROR_CODES.INVALID_EMAIL,
        emailValidation.error || AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.INVALID_EMAIL],
        400
      );
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      return createErrorResponse(
        AUTH_ERROR_CODES.INVALID_CREDENTIALS,
        AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.INVALID_CREDENTIALS],
        401
      );
    }

    // Check if user is active
    if (!user.isActive) {
      return CommonErrors.forbidden(AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.USER_INACTIVE]);
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return createErrorResponse(
        AUTH_ERROR_CODES.INVALID_CREDENTIALS,
        AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.INVALID_CREDENTIALS],
        401
      );
    }

    // Update last login time
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Create JWT token
    const token = createToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Create response with user data
    const response = createSuccessResponse({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });

    // Set httpOnly cookie
    response.cookies.set(authConfig.session.cookieName, token, {
      httpOnly: authConfig.session.cookieOptions.httpOnly,
      secure: authConfig.session.cookieOptions.secure,
      sameSite: authConfig.session.cookieOptions.sameSite,
      path: authConfig.session.cookieOptions.path,
      maxAge: authConfig.session.maxAge,
    });

    return response;
  } catch (error) {
    logger.error('Login error:', error);
    return CommonErrors.internal(undefined, { originalError: error instanceof Error ? error.message : 'Unknown error' });
  }
}

