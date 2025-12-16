/**
 * API Route: Logout
 * POST /api/auth/logout
 */

import { NextRequest } from 'next/server';
import { authConfig } from '@/lib/auth/config';
import { createSuccessResponse, CommonErrors } from '@/lib/api/response-utils';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    // Create response
    const response = createSuccessResponse({ message: 'Logged out successfully' });

    // Clear session cookie
    response.cookies.set(authConfig.session.cookieName, '', {
      httpOnly: authConfig.session.cookieOptions.httpOnly,
      secure: authConfig.session.cookieOptions.secure,
      sameSite: authConfig.session.cookieOptions.sameSite,
      path: authConfig.session.cookieOptions.path,
      maxAge: 0, // Expire immediately
    });

    return response;
  } catch (error) {
    logger.error('Logout error:', error);
    return CommonErrors.internal(undefined, { originalError: error instanceof Error ? error.message : 'Unknown error' });
  }
}

