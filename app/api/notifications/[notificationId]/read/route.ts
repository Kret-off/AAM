/**
 * API Route: Mark Notification as Read
 * POST /api/notifications/[notificationId]/read
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest, verifyToken } from '@/lib/auth/jwt';
import { AUTH_ERROR_CODES, AUTH_ERROR_MESSAGES } from '@/lib/auth/constants';
import { prisma } from '@/lib/prisma';

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
      return NextResponse.json(
        {
          error: {
            code: 'NOTIFICATION_NOT_FOUND',
            message: 'Notification not found',
          },
        },
        { status: 404 }
      );
    }

    // Check if user has access to this meeting
    const isOwner = processingError.meeting.ownerUserId === user.id;
    const isViewer = processingError.meeting.viewers.length > 0;
    const isAdmin = user.role === 'ADMIN';

    if (!isOwner && !isViewer && !isAdmin) {
      return NextResponse.json(
        {
          error: {
            code: 'UNAUTHORIZED_ACCESS',
            message: 'You do not have access to this notification',
          },
        },
        { status: 403 }
      );
    }

    // Update notification as read
    await prisma.processingError.update({
      where: { id: notificationId },
      data: { isRead: true },
    });

    return NextResponse.json(
      {
        data: {
          success: true,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Mark Notification Read API] Error:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to mark notification as read',
          details: { originalError: error instanceof Error ? error.message : 'Unknown error' },
        },
      },
      { status: 500 }
    );
  }
}








