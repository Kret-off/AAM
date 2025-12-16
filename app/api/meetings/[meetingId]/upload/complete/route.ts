/**
 * API Route: Complete Upload
 * POST /api/meetings/[meetingId]/upload/complete
 */

import { NextRequest } from 'next/server';
import { completeUpload } from '@/lib/upload/service';
import { CompleteUploadRequest } from '@/lib/upload/dto';
import { getTokenFromRequest, verifyToken } from '@/lib/auth/jwt';
import { AUTH_ERROR_CODES, AUTH_ERROR_MESSAGES } from '@/lib/auth/constants';
import { prisma } from '@/lib/prisma';
import { createSuccessResponse, createErrorResponse, CommonErrors } from '@/lib/api/response-utils';

export async function POST(
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

    const userId = user.id;

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch (error) {
      return CommonErrors.badRequest('Invalid JSON in request body');
    }

    const completeRequest: CompleteUploadRequest = {
      storagePath: body.storagePath,
    };

    // Validate required fields
    if (!completeRequest.storagePath) {
      return CommonErrors.badRequest('storagePath is required');
    }

    // Call service
    const result = await completeUpload(meetingId, userId, completeRequest);

    if ('error' in result) {
      const statusCode =
        result.error.code === 'UNAUTHORIZED_ACCESS' ||
        result.error.code === 'MEETING_NOT_FOUND' ||
        result.error.code === 'UPLOAD_BLOB_NOT_FOUND'
          ? 403
          : result.error.code === 'INVALID_MEETING_ID' ||
            result.error.code === 'MEETING_NOT_IN_UPLOADED_STATUS'
          ? 400
          : 500;

      return createErrorResponse(
        result.error.code,
        result.error.message,
        statusCode,
        result.error.details
      );
    }

    return createSuccessResponse(result.data);
  } catch (error) {
    return CommonErrors.internal(undefined, { originalError: error instanceof Error ? error.message : 'Unknown error' });
  }
}
