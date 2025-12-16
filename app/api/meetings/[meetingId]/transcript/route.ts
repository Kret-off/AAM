/**
 * API Route: Meeting Transcript
 * GET /api/meetings/[meetingId]/transcript - Get transcript
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkMeetingAccess } from '@/lib/meeting/rbac';
import { getTokenFromRequest, verifyToken } from '@/lib/auth/jwt';
import { AUTH_ERROR_CODES, AUTH_ERROR_MESSAGES } from '@/lib/auth/constants';
import { prisma } from '@/lib/prisma';

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

    // Check meeting access (owner + viewers + Admin can read transcript)
    const accessCheck = await checkMeetingAccess(meetingId, user.id, user.role);
    if (!accessCheck.allowed) {
      const statusCode =
        accessCheck.error?.code === 'MEETING_NOT_FOUND'
          ? 404
          : accessCheck.error?.code === 'UNAUTHORIZED_ACCESS'
          ? 403
          : 500;
      return NextResponse.json(
        {
          error: {
            code: accessCheck.error?.code || 'INTERNAL_ERROR',
            message: accessCheck.error?.message || 'Failed to check access',
          },
        },
        { status: statusCode }
      );
    }

    // Get transcript from database
    const transcript = await prisma.transcript.findUnique({
      where: { meetingId },
      select: {
        transcriptText: true,
      },
    });

    if (!transcript) {
      return NextResponse.json(
        {
          error: {
            code: 'TRANSCRIPT_NOT_FOUND',
            message: 'Transcript not found for this meeting',
          },
        },
        { status: 404 }
      );
    }

    // Return success response
    return NextResponse.json(
      {
        data: {
          transcript: transcript.transcriptText,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to process request',
          details: { originalError: error instanceof Error ? error.message : 'Unknown error' },
        },
      },
      { status: 500 }
    );
  }
}

