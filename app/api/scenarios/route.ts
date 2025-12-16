/**
 * API Route: Prompt Scenarios
 * GET /api/scenarios - List scenarios (filtered by user permissions for non-admins)
 * POST /api/scenarios - Create scenario (Admin only)
 */

import { NextRequest } from 'next/server';
import { getScenarios, createScenario } from '@/lib/scenario/service';
import { ScenariosQueryParams } from '@/lib/scenario/types';
import { CreateScenarioRequest } from '@/lib/scenario/dto';
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
        return createSuccessResponse({
          items: [],
          total: 0,
          page: 1,
          pageSize: pageSizeParam ? parseInt(pageSizeParam, 10) : 10,
          totalPages: 0,
        });
      }

      // If meetingTypeId is specified, verify user has access to it
      if (meetingTypeIdParam && !availableMeetingTypeIds.includes(meetingTypeIdParam)) {
        return CommonErrors.forbidden('Access denied to this meeting type');
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
      return createErrorResponse(
        result.error.code,
        result.error.message,
        statusCode,
        result.error.details
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
    return createSuccessResponse({
      items: filteredItems,
      total: user.role !== 'ADMIN' ? filteredItems.length : result.data.total,
      page: result.data.page,
      pageSize: result.data.pageSize,
      totalPages: user.role !== 'ADMIN' 
        ? Math.ceil(filteredItems.length / result.data.pageSize)
        : result.data.totalPages,
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
      return CommonErrors.badRequest('meetingTypeId, name, systemPrompt, outputSchema, and artifactsConfig are required');
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
      return createErrorResponse(
        result.error.code,
        result.error.message,
        statusCode,
        result.error.details
      );
    }

    // Return success response
    return createCreatedResponse({
      scenario: result.data,
    });
  } catch (error) {
    return CommonErrors.internal(undefined, { originalError: error instanceof Error ? error.message : 'Unknown error' });
  }
}

