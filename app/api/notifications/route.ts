/**
 * API Route: Notifications
 * GET /api/notifications - Get error notifications for user
 */

import { NextRequest } from 'next/server';
import { getTokenFromRequest, verifyToken } from '@/lib/auth/jwt';
import { AUTH_ERROR_CODES, AUTH_ERROR_MESSAGES } from '@/lib/auth/constants';
import { prisma } from '@/lib/prisma';
import { MeetingStatus } from '@prisma/client';
import { createSuccessResponse, createErrorResponse, CommonErrors } from '@/lib/api/response-utils';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
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

    // Calculate 24 hours ago
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    // Build where clause for meetings
    // User can see meetings where they are owner, viewer, or admin
    const meetingWhere: {
      status: { in: MeetingStatus[] };
      OR: Array<{
        ownerUserId?: string;
        viewers?: { some: { userId: string } };
      }>;
    } = {
      status: {
        in: ['Failed_Transcription', 'Failed_LLM', 'Failed_System'],
      },
      OR: [],
    };

    if (user.role === 'ADMIN') {
      // Admin can see all meetings
      delete meetingWhere.OR;
    } else {
      // Regular users can see their own meetings or meetings where they are viewers
      meetingWhere.OR = [
        { ownerUserId: user.id },
        { viewers: { some: { userId: user.id } } },
      ];
    }

    // Get meetings with failed statuses
    const meetings = await prisma.meeting.findMany({
      where: meetingWhere,
      select: {
        id: true,
        title: true,
        status: true,
        processingErrors: {
          where: {
            OR: [
              { isRead: false },
              { occurredAt: { gte: twentyFourHoursAgo } },
            ],
          },
          orderBy: {
            occurredAt: 'desc',
          },
          take: 1, // Get only latest error per meeting
          select: {
            id: true,
            stage: true,
            errorCode: true,
            errorMessage: true,
            occurredAt: true,
            isRead: true,
          },
        },
      },
    });

    // Transform to notifications format
    const notifications = meetings
      .filter((meeting) => meeting.processingErrors.length > 0)
      .map((meeting) => {
        const error = meeting.processingErrors[0];
        return {
          id: error.id,
          meetingId: meeting.id,
          meetingTitle: meeting.title || `Встреча ${meeting.id.slice(0, 8)}`,
          errorType: error.stage as 'transcription' | 'llm' | 'system',
          errorMessage: error.errorMessage,
          occurredAt: error.occurredAt.toISOString(),
          isRead: error.isRead,
        };
      });

    return createSuccessResponse(notifications);
  } catch (error) {
    logger.error('[Notifications API] Error:', error);
    return CommonErrors.internal('Failed to fetch notifications', { originalError: error instanceof Error ? error.message : 'Unknown error' });
  }
}








