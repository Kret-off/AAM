/**
 * API Route: Notifications
 * GET /api/notifications - Get error notifications for user
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest, verifyToken } from '@/lib/auth/jwt';
import { AUTH_ERROR_CODES, AUTH_ERROR_MESSAGES } from '@/lib/auth/constants';
import { prisma } from '@/lib/prisma';
import { MeetingStatus } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    // Get token from cookies
    const cookieHeader = request.headers.get('cookie');
    const token = getTokenFromRequest(cookieHeader);

    if (!token) {
      return NextResponse.json(
        {
          error: {
            code: AUTH_ERROR_CODES.UNAUTHORIZED,
            message: AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.UNAUTHORIZED],
          },
        },
        { status: 401 }
      );
    }

    // Verify token
    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        {
          error: {
            code: AUTH_ERROR_CODES.INVALID_SESSION,
            message: AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.INVALID_SESSION],
          },
        },
        { status: 401 }
      );
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
      return NextResponse.json(
        {
          error: {
            code: AUTH_ERROR_CODES.USER_NOT_FOUND,
            message: AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.USER_NOT_FOUND],
          },
        },
        { status: 404 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        {
          error: {
            code: AUTH_ERROR_CODES.USER_INACTIVE,
            message: AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.USER_INACTIVE],
          },
        },
        { status: 403 }
      );
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

    return NextResponse.json(
      {
        data: notifications,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Notifications API] Error:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch notifications',
          details: { originalError: error instanceof Error ? error.message : 'Unknown error' },
        },
      },
      { status: 500 }
    );
  }
}








