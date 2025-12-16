/**
 * API Route: Meeting Viewers
 * GET /api/meetings/[meetingId]/viewers - List viewers
 * POST /api/meetings/[meetingId]/viewers - Add viewer
 * DELETE /api/meetings/[meetingId]/viewers - Remove viewer
 */

import { NextRequest } from 'next/server';
import { getMeetingViewers, addViewer, removeViewer } from '@/lib/meeting/viewers';
import { checkMeetingAccess } from '@/lib/meeting/rbac';
import { AddViewerRequest } from '@/lib/meeting/dto';
import { getTokenFromRequest, verifyToken } from '@/lib/auth/jwt';
import { AUTH_ERROR_CODES, AUTH_ERROR_MESSAGES } from '@/lib/auth/constants';
import { prisma } from '@/lib/prisma';
import { createSuccessResponse, createCreatedResponse, createErrorResponse, CommonErrors } from '@/lib/api/response-utils';

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

    // Check meeting access (owner + viewers + Admin can see viewers list)
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

    // Call service
    const result = await getMeetingViewers(meetingId);

    // Handle error response
    if ('error' in result) {
      const statusCode =
        result.error.code === 'MEETING_NOT_FOUND' ? 404 : 500;
      return createErrorResponse(
        result.error.code,
        result.error.message,
        statusCode,
        result.error.details
      );
    }

    // Return success response
    return createSuccessResponse({
      viewers: result.data,
    });
  } catch (error) {
    return CommonErrors.internal(undefined, { originalError: error instanceof Error ? error.message : 'Unknown error' });
  }
}

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

    const addViewerRequest: AddViewerRequest = {
      userId: body.userId,
    };

    // Validate required fields
    if (!addViewerRequest.userId) {
      return CommonErrors.badRequest('userId is required');
    }

    // Call service (owner access check is done inside addViewer)
    const result = await addViewer(meetingId, addViewerRequest.userId, user.id);

    // Handle error response
    if ('error' in result) {
      const statusCode =
        result.error.code === 'MEETING_NOT_FOUND' || result.error.code === 'USER_NOT_FOUND'
          ? 404
          : result.error.code === 'ONLY_OWNER_CAN_VALIDATE' || result.error.code === 'UNAUTHORIZED_ACCESS'
          ? 403
          : result.error.code === 'VIEWER_ALREADY_EXISTS'
          ? 409
          : 400;
      return createErrorResponse(
        result.error.code,
        result.error.message,
        statusCode,
        result.error.details
      );
    }

    // Return success response
    return createCreatedResponse({
      success: true,
      viewer: result.data,
    });
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

    // Extract userId from query params or body
    const searchParams = request.nextUrl.searchParams;
    let userIdToRemove = searchParams.get('userId');

    // If not in query, try to get from body
    if (!userIdToRemove) {
      try {
        const body = await request.json();
        userIdToRemove = body.userId;
      } catch {
        // Body parsing failed or empty, continue with query param only
      }
    }

    // Validate required fields
    if (!userIdToRemove) {
      return CommonErrors.badRequest('userId is required (query param or body)');
    }

    // Call service (owner access check is done inside removeViewer)
    const result = await removeViewer(meetingId, userIdToRemove, user.id);

    // Handle error response
    if ('error' in result) {
      const statusCode =
        result.error.code === 'MEETING_NOT_FOUND'
          ? 404
          : result.error.code === 'ONLY_OWNER_CAN_VALIDATE' || result.error.code === 'UNAUTHORIZED_ACCESS'
          ? 403
          : result.error.code === 'VIEWER_NOT_FOUND'
          ? 404
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
