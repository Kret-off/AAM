/**
 * API Route: Validate Meeting
 * POST /api/meetings/[meetingId]/validate
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateMeeting } from '@/lib/meeting/validation-service';
import { ValidateMeetingRequest } from '@/lib/meeting/dto';
import { getTokenFromRequest, verifyToken } from '@/lib/auth/jwt';
import { AUTH_ERROR_CODES, AUTH_ERROR_MESSAGES } from '@/lib/auth/constants';
import { prisma } from '@/lib/prisma';
import { validateMeetingId } from '@/lib/meeting/validation';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  try {
    const { meetingId } = await params;

    // Validate meeting ID format
    const idValidation = validateMeetingId(meetingId);
    if (!idValidation.valid) {
      return NextResponse.json(
        {
          error: {
            code: idValidation.error!.code,
            message: idValidation.error!.message,
          },
        },
        { status: 400 }
      );
    }

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

    // Parse request body
    const body = await request.json();
    const validateRequest: ValidateMeetingRequest = {
      decision: body.decision,
      rejectionReason: body.rejectionReason,
    };

    // Validate required fields
    if (!validateRequest.decision) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_REQUEST',
            message: 'decision is required',
          },
        },
        { status: 400 }
      );
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
      return NextResponse.json(
        {
          error: {
            code: result.error.code,
            message: result.error.message,
            details: result.error.details,
          },
        },
        { status: statusCode }
      );
    }

    // Return success response
    return NextResponse.json(
      {
        data: {
          success: true,
          decision: result.decision,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    // Handle JSON parse errors
    if (error instanceof SyntaxError || (error instanceof Error && error.message.includes('JSON'))) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_REQUEST',
            message: 'Invalid JSON in request body',
          },
        },
        { status: 400 }
      );
    }

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

