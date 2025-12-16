/**
 * API Route: Validate Meeting
 * POST /api/meetings/[meetingId]/validate
 */

import { NextRequest } from 'next/server';
import { validateMeeting } from '@/lib/meeting/validation-service';
import { ValidateMeetingRequest } from '@/lib/meeting/dto';
import { getTokenFromRequest, verifyToken } from '@/lib/auth/jwt';
import { AUTH_ERROR_CODES, AUTH_ERROR_MESSAGES } from '@/lib/auth/constants';
import { prisma } from '@/lib/prisma';
import { validateMeetingId } from '@/lib/meeting/validation';
import { createSuccessResponse, createErrorResponse, CommonErrors } from '@/lib/api/response-utils';

export async function POST(
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

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
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

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch (error) {
      return CommonErrors.badRequest('Invalid JSON in request body');
    }

    const validateRequest: ValidateMeetingRequest = {
      decision: body.decision,
      rejectionReason: body.rejectionReason,
    };

    // Validate required fields
    if (!validateRequest.decision) {
      return CommonErrors.badRequest('decision is required');
    }

    // Call service (owner access check is done inside validateMeeting)
    const result = await validateMeeting(meetingId, validateRequest, user.id);

    // Handle error response
    if ('error' in result) {
      const statusCode =
        result.error.code === 'MEETING_NOT_FOUND'
          ? 404
          : result.error.code === 'ONLY_OWNER_CAN_VALIDATE' || result.error.code === 'UNAUTHORIZED_ACCESS'
          ? 403
          : result.error.code === 'MEETING_NOT_READY' || result.error.code === 'INVALID_STATUS'
          ? 400
          : 400;
      return createErrorResponse(
        result.error.code,
        result.error.message,
        statusCode,
        result.error.details
      );
    }

    // Return success response
    return createSuccessResponse({
      success: true,
      decision: result.decision,
    });
  } catch (error) {
    return CommonErrors.internal(undefined, { originalError: error instanceof Error ? error.message : 'Unknown error' });
  }
}
