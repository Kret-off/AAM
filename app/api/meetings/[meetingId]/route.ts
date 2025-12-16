/**
 * API Route: Meeting by ID
 * GET /api/meetings/[meetingId] - Get meeting
 * PATCH /api/meetings/[meetingId] - Update meeting
 * DELETE /api/meetings/[meetingId] - Delete meeting
 */

import { NextRequest } from 'next/server';
import { getMeetingDetail } from '@/lib/meeting/service';
import { getTokenFromRequest, verifyToken } from '@/lib/auth/jwt';
import { AUTH_ERROR_CODES, AUTH_ERROR_MESSAGES } from '@/lib/auth/constants';
import { prisma } from '@/lib/prisma';
import { validateMeetingId } from '@/lib/meeting/validation';
import { createSuccessResponse, createErrorResponse, CommonErrors } from '@/lib/api/response-utils';
import { logger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  try {
    const { meetingId } = await params;

    // Validate meeting ID format
    const idValidation = validateMeetingId(meetingId);
    if (!idValidation.valid) {
      return CommonErrors.badRequest(idValidation.error!.message, { code: idValidation.error!.code });
    }

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

    // Call service (RBAC check is done inside getMeetingDetail)
    const result = await getMeetingDetail(meetingId, user.id, user.role);

    // Log response for debugging
    if ('data' in result) {
      logger.info('[API] Meeting detail response:', {
        meetingId,
        status: result.data.status,
        hasTranscript: result.data.hasTranscript,
        hasArtifacts: result.data.hasArtifacts,
      });
    }

    // Handle error response
    if ('error' in result) {
      // Log error for debugging
      logger.error('Error fetching meeting details:', {
        meetingId,
        userId: user.id,
        errorCode: result.error.code,
        errorMessage: result.error.message,
        errorDetails: result.error.details,
      });

      const statusCode =
        result.error.code === 'MEETING_NOT_FOUND'
          ? 404
          : result.error.code === 'UNAUTHORIZED_ACCESS'
          ? 403
          : 500;
      return createErrorResponse(
        result.error.code,
        result.error.message,
        statusCode,
        result.error.details
      );
    }

    // Return success response
    return createSuccessResponse(result.data);
  } catch (error) {
    return CommonErrors.internal(undefined, { originalError: error instanceof Error ? error.message : 'Unknown error' });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  try {
    const { meetingId } = await params;

    // Validate meeting ID format
    const idValidation = validateMeetingId(meetingId);
    if (!idValidation.valid) {
      return CommonErrors.badRequest(idValidation.error!.message, { code: idValidation.error!.code });
    }
    // TODO: Implement update meeting logic
    return createErrorResponse(
      'NOT_IMPLEMENTED',
      'Update meeting endpoint not yet implemented',
      501
    );
  } catch (error) {
    return CommonErrors.internal(undefined, { originalError: error instanceof Error ? error.message : 'Unknown error' });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  try {
    const { meetingId } = await params;

    // Validate meeting ID format
    const idValidation = validateMeetingId(meetingId);
    if (!idValidation.valid) {
      return CommonErrors.badRequest(idValidation.error!.message, { code: idValidation.error!.code });
    }
    // TODO: Implement delete meeting logic
    return createErrorResponse(
      'NOT_IMPLEMENTED',
      'Delete meeting endpoint not yet implemented',
      501
    );
  } catch (error) {
    return CommonErrors.internal(undefined, { originalError: error instanceof Error ? error.message : 'Unknown error' });
  }
}
