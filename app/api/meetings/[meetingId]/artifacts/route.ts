/**
 * API Route: Meeting Artifacts
 * GET /api/meetings/[meetingId]/artifacts - Get artifacts
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

    // Check meeting access (owner + viewers + Admin can read artifacts)
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

    // Get meeting with scenario to get artifactsConfig
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      select: {
        scenario: {
          select: {
            artifactsConfig: true,
          },
        },
      },
    });

    if (!meeting) {
      return NextResponse.json(
        {
          error: {
            code: 'MEETING_NOT_FOUND',
            message: 'Meeting not found',
          },
        },
        { status: 404 }
      );
    }

    // Get artifacts from database
    const artifacts = await prisma.artifacts.findUnique({
      where: { meetingId },
      select: {
        artifactsPayload: true,
      },
    });

    if (!artifacts) {
      return NextResponse.json(
        {
          error: {
            code: 'ARTIFACTS_NOT_FOUND',
            message: 'Artifacts not found for this meeting',
          },
        },
        { status: 404 }
      );
    }

    // Return success response
    // artifactsPayload contains { artifacts: {...}, quality: {...} }
    // Also include artifactsConfig from scenario
    return NextResponse.json(
      {
        data: {
          artifacts: artifacts.artifactsPayload,
          artifactsConfig: meeting.scenario.artifactsConfig || { sections: [] },
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


