/**
 * API Route: Meeting Types (Admin only)
 * GET /api/meeting-types - List meeting types
 * POST /api/meeting-types - Create meeting type
 */

import { NextRequest } from 'next/server';
import { getMeetingTypes, createMeetingType } from '@/lib/scenario/service';
import { MeetingTypesQueryParams } from '@/lib/scenario/types';
import { CreateMeetingTypeRequest } from '@/lib/scenario/dto';
import { getTokenFromRequest, verifyToken } from '@/lib/auth/jwt';
import { AUTH_ERROR_CODES, AUTH_ERROR_MESSAGES } from '@/lib/auth/constants';
import { prisma } from '@/lib/prisma';
import { createSuccessResponse, createCreatedResponse, createErrorResponse, CommonErrors } from '@/lib/api/response-utils';

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

    // Get user from database to get role
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
      return createErrorResponse(
        AUTH_ERROR_CODES.USER_NOT_FOUND,
        AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.USER_NOT_FOUND],
        404
      );
    }

    if (!user.isActive) {
      return CommonErrors.forbidden(AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.USER_INACTIVE]);
    }

    // Extract query parameters
    const searchParams = request.nextUrl.searchParams;
    const isActiveParam = searchParams.get('isActive');

    // Build query params
    const queryParams: MeetingTypesQueryParams = {
      isActive: isActiveParam ? isActiveParam === 'true' : undefined,
    };

    // Call service
    const result = await getMeetingTypes(queryParams);

    // Handle error response
    if ('error' in result) {
      return createErrorResponse(
        result.error.code,
        result.error.message,
        500,
        result.error.details
      );
    }

    // Filter meeting types for non-admin users
    let filteredMeetingTypes = result.data;
    if (user.role !== 'ADMIN') {
      const availableMeetingTypeIds = new Set(
        user.availableMeetingTypes.map((umt) => umt.meetingTypeId)
      );
      filteredMeetingTypes = result.data.filter((mt) =>
        availableMeetingTypeIds.has(mt.id)
      );
    }

    // Return success response
    return createSuccessResponse({
      items: filteredMeetingTypes,
    });
  } catch (error) {
    return CommonErrors.internal(undefined, { originalError: error instanceof Error ? error.message : 'Unknown error' });
  }
}

export async function POST(request: NextRequest) {
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
      return createErrorResponse(
        AUTH_ERROR_CODES.USER_NOT_FOUND,
        AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.USER_NOT_FOUND],
        404
      );
    }

    if (!user.isActive) {
      return CommonErrors.forbidden(AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.USER_INACTIVE]);
    }

    // Check admin access
    if (user.role !== 'ADMIN') {
      return CommonErrors.forbidden('Admin access required');
    }

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch (error) {
      return CommonErrors.badRequest('Invalid JSON in request body');
    }

    const createRequest: CreateMeetingTypeRequest = {
      name: body.name,
      isActive: body.isActive,
      userIds: body.userIds || [],
    };

    // Validate required fields
    if (!createRequest.name) {
      return CommonErrors.badRequest('name is required');
    }

    // Call service (validation is done inside createMeetingType)
    const result = await createMeetingType(createRequest, user.role);

    // Handle error response
    if ('error' in result) {
      const statusCode =
        result.error.code === 'UNAUTHORIZED_ACCESS' ? 403 : 400;
      return createErrorResponse(
        result.error.code,
        result.error.message,
        statusCode,
        result.error.details
      );
    }

    // Return success response
    return createCreatedResponse({
      meetingType: result.data,
    });
  } catch (error) {
    return CommonErrors.internal(undefined, { originalError: error instanceof Error ? error.message : 'Unknown error' });
  }
}

