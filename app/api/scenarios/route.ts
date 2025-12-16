/**
 * API Route: Prompt Scenarios
 * GET /api/scenarios - List scenarios (filtered by user permissions for non-admins)
 * POST /api/scenarios - Create scenario (Admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getScenarios, createScenario } from '@/lib/scenario/service';
import { ScenariosQueryParams } from '@/lib/scenario/types';
import { CreateScenarioRequest } from '@/lib/scenario/dto';
import { getTokenFromRequest, verifyToken } from '@/lib/auth/jwt';
import { AUTH_ERROR_CODES, AUTH_ERROR_MESSAGES } from '@/lib/auth/constants';
import { prisma } from '@/lib/prisma';

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

    // Get user from database to get role and available meeting types
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        role: true,
        isActive: true,
        availableMeetingTypes: {
          select: {
            meetingTypeId: true,
          },
        },
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
    const meetingTypeIdParam = searchParams.get('meetingTypeId');
    const isActiveParam = searchParams.get('isActive');
    const searchParam = searchParams.get('search');

    // For non-admin users, filter by available meeting types
    let availableMeetingTypeIds: string[] | undefined;
    if (user.role !== 'ADMIN') {
      availableMeetingTypeIds = user.availableMeetingTypes.map(
        (umt) => umt.meetingTypeId
      );

      // If user has no available meeting types, return empty result
      if (availableMeetingTypeIds.length === 0) {
        return NextResponse.json(
          {
            data: {
              items: [],
              total: 0,
              page: 1,
              pageSize: pageSizeParam ? parseInt(pageSizeParam, 10) : 10,
              totalPages: 0,
            },
          },
          { status: 200 }
        );
      }

      // If meetingTypeId is specified, verify user has access to it
      if (meetingTypeIdParam && !availableMeetingTypeIds.includes(meetingTypeIdParam)) {
        return NextResponse.json(
          {
            error: {
              code: 'UNAUTHORIZED_ACCESS',
              message: 'Access denied to this meeting type',
            },
          },
          { status: 403 }
        );
      }
    }

    // Build query params
    const queryParams: ScenariosQueryParams = {
      page: pageParam ? parseInt(pageParam, 10) : undefined,
      pageSize: pageSizeParam ? parseInt(pageSizeParam, 10) : undefined,
      filter: {
        meetingTypeId: meetingTypeIdParam || undefined,
        // For non-admin users, only show active scenarios
        isActive: user.role !== 'ADMIN' ? true : isActiveParam ? isActiveParam === 'true' : undefined,
        search: searchParam || undefined,
      },
    };

    // Call service
    const result = await getScenarios(queryParams);

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

    // For non-admin users, filter results by available meeting types
    let filteredItems = result.data.items;
    if (user.role !== 'ADMIN' && availableMeetingTypeIds) {
      filteredItems = result.data.items.filter((scenario) =>
        availableMeetingTypeIds!.includes(scenario.meetingTypeId)
      );
    }

    // Return success response
    return NextResponse.json(
      {
        data: {
          items: filteredItems,
          total: user.role !== 'ADMIN' ? filteredItems.length : result.data.total,
          page: result.data.page,
          pageSize: result.data.pageSize,
          totalPages: user.role !== 'ADMIN' 
            ? Math.ceil(filteredItems.length / result.data.pageSize)
            : result.data.totalPages,
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
    const createRequest: CreateScenarioRequest = {
      meetingTypeId: body.meetingTypeId,
      name: body.name,
      systemPrompt: body.systemPrompt,
      outputSchema: body.outputSchema,
      artifactsConfig: body.artifactsConfig,
      isActive: body.isActive,
    };

    // Validate required fields
    if (!createRequest.meetingTypeId || !createRequest.name || !createRequest.systemPrompt || 
        !createRequest.outputSchema || !createRequest.artifactsConfig) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_REQUEST',
            message: 'meetingTypeId, name, systemPrompt, outputSchema, and artifactsConfig are required',
          },
        },
        { status: 400 }
      );
    }

    // Call service (validation is done inside createScenario)
    const result = await createScenario(createRequest, user.id, user.role);

    // Handle error response
    if ('error' in result) {
      const statusCode =
        result.error.code === 'MEETING_TYPE_NOT_FOUND' || result.error.code === 'USER_NOT_FOUND'
          ? 404
          : result.error.code === 'UNAUTHORIZED_ACCESS'
          ? 403
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
          scenario: result.data,
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

