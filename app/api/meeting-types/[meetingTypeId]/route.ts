/**
 * API Route: Meeting Type by ID (Admin only)
 * GET /api/meeting-types/[meetingTypeId] - Get meeting type
 * PATCH /api/meeting-types/[meetingTypeId] - Update meeting type
 * DELETE /api/meeting-types/[meetingTypeId] - Delete meeting type
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMeetingTypeById, updateMeetingType, deleteMeetingType } from '@/lib/scenario/service';
import { UpdateMeetingTypeRequest } from '@/lib/scenario/dto';
import { getTokenFromRequest, verifyToken } from '@/lib/auth/jwt';
import { AUTH_ERROR_CODES, AUTH_ERROR_MESSAGES } from '@/lib/auth/constants';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ meetingTypeId: string }> }
) {
  try {
    const { meetingTypeId } = await params;
    
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

    // Check admin access
    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        {
          error: {
            code: 'UNAUTHORIZED_ACCESS',
            message: 'Admin access required',
          },
        },
        { status: 403 }
      );
    }

    // Call service
    const result = await getMeetingTypeById(meetingTypeId);

    // Handle error response
    if ('error' in result) {
      const statusCode =
        result.error.code === 'MEETING_TYPE_NOT_FOUND' ? 404 : 500;
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
        data: result.data,
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ meetingTypeId: string }> }
) {
  try {
    const { meetingTypeId } = await params;
    
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

    // Check admin access
    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        {
          error: {
            code: 'UNAUTHORIZED_ACCESS',
            message: 'Admin access required',
          },
        },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const updateRequest: UpdateMeetingTypeRequest = {
      name: body.name,
      isActive: body.isActive,
      userIds: body.userIds !== undefined ? body.userIds : undefined,
    };

    // Call service (validation is done inside updateMeetingType)
    const result = await updateMeetingType(
      meetingTypeId,
      updateRequest,
      user.role
    );

    // Handle error response
    if ('error' in result) {
      const statusCode =
        result.error.code === 'MEETING_TYPE_NOT_FOUND' ? 404
        : result.error.code === 'UNAUTHORIZED_ACCESS' ? 403
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
        data: result.data,
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ meetingTypeId: string }> }
) {
  try {
    const { meetingTypeId } = await params;
    
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

    // Check admin access
    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        {
          error: {
            code: 'UNAUTHORIZED_ACCESS',
            message: 'Admin access required',
          },
        },
        { status: 403 }
      );
    }

    // Call service
    const result = await deleteMeetingType(meetingTypeId, user.role);

    // Handle error response
    if ('error' in result) {
      const statusCode =
        result.error.code === 'MEETING_TYPE_NOT_FOUND' ? 404
        : result.error.code === 'UNAUTHORIZED_ACCESS' ? 403
        : result.error.code === 'MEETING_TYPE_IN_USE' ? 400
        : 500;
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
        data: result.data,
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
