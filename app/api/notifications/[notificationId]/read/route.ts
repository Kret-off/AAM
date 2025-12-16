/**
 * API Route: Mark Notification as Read
 * POST /api/notifications/[notificationId]/read
 */

import { NextRequest } from 'next/server';
import { getTokenFromRequest, verifyToken } from '@/lib/auth/jwt';
import { AUTH_ERROR_CODES, AUTH_ERROR_MESSAGES } from '@/lib/auth/constants';
import { prisma } from '@/lib/prisma';
import { createSuccessResponse, createErrorResponse, CommonErrors } from '@/lib/api/response-utils';
import { logger } from '@/lib/logger';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ notificationId: string }> }
) {
  try {
    const { notificationId } = await params;
    
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

    // Get the processing error (notification)
    const processingError = await prisma.processingError.findUnique({
      where: { id: notificationId },
      select: {
        id: true,
        meetingId: true,
        meeting: {
          select: {
            ownerUserId: true,
            viewers: {
              where: { userId: user.id },
              select: { userId: true },
            },
          },
        },
      },
    });

    if (!processingError) {
      return CommonErrors.notFound('Notification');
    }

    // Check if user has access to this meeting
    const isOwner = processingError.meeting.ownerUserId === user.id;
    const isViewer = processingError.meeting.viewers.length > 0;
    const isAdmin = user.role === 'ADMIN';

    if (!isOwner && !isViewer && !isAdmin) {
      return CommonErrors.forbidden('You do not have access to this notification');
    }

    // Update notification as read
    await prisma.processingError.update({
      where: { id: notificationId },
      data: { isRead: true },
    });

    return createSuccessResponse({
      success: true,
    });
  } catch (error) {
    logger.error('[Mark Notification Read API] Error:', error);
    return CommonErrors.internal('Failed to mark notification as read', { originalError: error instanceof Error ? error.message : 'Unknown error' });
  }
}
