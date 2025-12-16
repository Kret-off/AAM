/**
 * API Route: Meeting LLM Interactions
 * GET /api/meetings/[meetingId]/llm-interactions - Get LLM interaction history
 */

import { NextRequest } from 'next/server';
import { checkMeetingAccess } from '@/lib/meeting/rbac';
import { getTokenFromRequest, verifyToken } from '@/lib/auth/jwt';
import { AUTH_ERROR_CODES, AUTH_ERROR_MESSAGES } from '@/lib/auth/constants';
import { prisma } from '@/lib/prisma';
import { getLLMInteractions } from '@/lib/llm-interaction';
import { createSuccessResponse, createErrorResponse, CommonErrors } from '@/lib/api/response-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  try {
    const { meetingId } = await params;

    // Get token from cookies
    const cookieHeader = request.headers.get('cookie');
    const token = getTokenFromRequest(cookieHeader);

    if (!token) {
      return CommonErrors.unauthorized(AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.UNAUTHORIZED]);
    }

    // Verify token
    const payload = verifyToken(token);
    if (!payload) {
      return CommonErrors.unauthorized(AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.INVALID_SESSION]);
    }

    // Get user from database to get role
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        role: true,
        isActive: true,
      },
    });

    if (!user) {
      return createErrorResponse(
        AUTH_ERROR_CODES.USER_NOT_FOUND,
        AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.USER_NOT_FOUND],
        404
      );
    }

    if (!user.isActive) {
      return CommonErrors.forbidden(AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.USER_INACTIVE]);
    }

    // Check meeting access (owner + viewers + Admin can read LLM interactions)
    const accessCheck = await checkMeetingAccess(meetingId, user.id, user.role);
    if (!accessCheck.allowed) {
      const statusCode =
        accessCheck.error?.code === 'MEETING_NOT_FOUND'
          ? 404
          : accessCheck.error?.code === 'UNAUTHORIZED_ACCESS'
          ? 403
          : 500;
      return createErrorResponse(
        accessCheck.error?.code || 'INTERNAL_ERROR',
        accessCheck.error?.message || 'Failed to check access',
        statusCode
      );
    }

    // Get LLM interactions from database
    const interactions = await getLLMInteractions(meetingId);

    // Return success response
    return createSuccessResponse({
      interactions,
    });
  } catch (error) {
    return CommonErrors.internal(undefined, { originalError: error instanceof Error ? error.message : 'Unknown error' });
  }
}
