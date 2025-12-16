/**
 * API Route: Meetings
 * GET /api/meetings - List meetings
 * POST /api/meetings - Create meeting
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMeetings, createMeeting } from '@/lib/meeting/service';
import { MeetingsQueryParams } from '@/lib/meeting/types';
import { CreateMeetingRequest } from '@/lib/meeting/dto';
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

    // Extract query parameters
    const searchParams = request.nextUrl.searchParams;
    const pageParam = searchParams.get('page');
    const pageSizeParam = searchParams.get('pageSize');
    const statusParam = searchParams.get('status');
    const ownerUserIdParam = searchParams.get('ownerUserId');
    const clientIdParam = searchParams.get('clientId');
    const meetingTypeIdParam = searchParams.get('meetingTypeId');
    const searchParam = searchParams.get('search');

    // Build query params
    const queryParams: MeetingsQueryParams = {
      page: pageParam ? parseInt(pageParam, 10) : undefined,
      pageSize: pageSizeParam ? parseInt(pageSizeParam, 10) : undefined,
      filter: {
        status: statusParam ? (statusParam as MeetingStatus) : undefined,
        ownerUserId: ownerUserIdParam || undefined,
        clientId: clientIdParam || undefined,
        meetingTypeId: meetingTypeIdParam || undefined,
        search: searchParam || undefined,
      },
    };

    // Call service
    const result = await getMeetings(queryParams, user.id, user.role);

    // Handle error response
    if ('error' in result) {
      const statusCode =
        result.error.code === 'INVALID_PAGINATION_PARAMS' ? 400 : 500;
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
          items: result.data.items,
          total: result.data.total,
          page: result.data.page,
          pageSize: result.data.pageSize,
          totalPages: result.data.totalPages,
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

export async function POST(request: NextRequest) {
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
    const createRequest: CreateMeetingRequest = {
      clientId: body.clientId,
      meetingTypeId: body.meetingTypeId,
      scenarioId: body.scenarioId,
      title: body.title,
      participantIds: body.participantIds || [],
    };

    // Validate required fields
    if (!createRequest.clientId || !createRequest.meetingTypeId || !createRequest.scenarioId) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_REQUEST',
            message: 'clientId, meetingTypeId, and scenarioId are required',
          },
        },
        { status: 400 }
      );
    }

    // Call service
    const result = await createMeeting(createRequest, user.id);

    // Handle error response
    if ('error' in result) {
      const statusCode =
        result.error.code === 'CLIENT_NOT_FOUND' ||
        result.error.code === 'MEETING_TYPE_NOT_FOUND' ||
        result.error.code === 'SCENARIO_NOT_FOUND' ||
        result.error.code === 'PARTICIPANT_NOT_FOUND' ||
        result.error.code === 'USER_NOT_FOUND'
          ? 404
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
          meeting: result.data,
        },
      },
      { status: 201 }
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

