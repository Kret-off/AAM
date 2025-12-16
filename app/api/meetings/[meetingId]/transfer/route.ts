/**
 * API Route: Transfer Meeting Ownership
 * POST /api/meetings/[meetingId]/transfer
 */

import { NextRequest } from 'next/server';
import { transferOwnership } from '@/lib/meeting/viewers';
import { TransferOwnershipRequest } from '@/lib/meeting/dto';
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

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch (error) {
      return CommonErrors.badRequest('Invalid JSON in request body');
    }

    const transferRequest: TransferOwnershipRequest = {
      newOwnerUserId: body.newOwnerUserId,
    };

    // Validate required fields
    if (!transferRequest.newOwnerUserId) {
      return CommonErrors.badRequest('newOwnerUserId is required');
    }

    // Call service (owner access check is done inside transferOwnership)
    const result = await transferOwnership(meetingId, transferRequest, user.id);

    // Handle error response
    if ('error' in result) {
      const statusCode =
        result.error.code === 'MEETING_NOT_FOUND' || result.error.code === 'USER_NOT_FOUND'
          ? 404
          : result.error.code === 'ONLY_OWNER_CAN_VALIDATE' || result.error.code === 'UNAUTHORIZED_ACCESS'
          ? 403
          : result.error.code === 'CANNOT_TRANSFER_TO_SELF'
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
    });
  } catch (error) {
    return CommonErrors.internal(undefined, { originalError: error instanceof Error ? error.message : 'Unknown error' });
  }
}
