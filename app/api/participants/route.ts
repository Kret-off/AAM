/**
 * API Route: Participants
 * GET /api/participants - List participants
 * POST /api/participants - Create participant
 */

import { NextRequest } from 'next/server';
import { getParticipants, createParticipant } from '@/lib/directory/service';
import { ParticipantsQueryParams, ParticipantType } from '@/lib/directory/types';
import { CreateParticipantRequest } from '@/lib/directory/dto';
import { getTokenFromRequest, verifyToken } from '@/lib/auth/jwt';
import { AUTH_ERROR_CODES, AUTH_ERROR_MESSAGES } from '@/lib/auth/constants';
import { prisma } from '@/lib/prisma';
import { createSuccessResponse, createCreatedResponse, createErrorResponse, CommonErrors } from '@/lib/api/response-utils';

export async function GET(request: NextRequest) {
  try {
    // Extract query parameters
    const searchParams = request.nextUrl.searchParams;
    const pageParam = searchParams.get('page');
    const pageSizeParam = searchParams.get('pageSize');
    const searchParam = searchParams.get('search');
    const typeParam = searchParams.get('type');
    const isActiveParam = searchParams.get('isActive');

    // Build query params
    const queryParams: ParticipantsQueryParams = {
      page: pageParam ? parseInt(pageParam, 10) : undefined,
      pageSize: pageSizeParam ? parseInt(pageSizeParam, 10) : undefined,
      filter: {
        search: searchParam || undefined,
        type: typeParam ? (typeParam as ParticipantType) : undefined,
        isActive: isActiveParam ? isActiveParam === 'true' : undefined,
      },
    };

    // Call service
    const result = await getParticipants(queryParams);

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

    // Return success response
    return createSuccessResponse({
      items: result.data.items,
      total: result.data.total,
      page: result.data.page,
      pageSize: result.data.pageSize,
      totalPages: result.data.totalPages,
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

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
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

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch (error) {
      return CommonErrors.badRequest('Invalid JSON in request body');
    }
    const createRequest: CreateParticipantRequest = {
      type: body.type,
      fullName: body.fullName,
      roleTitle: body.roleTitle,
      companyName: body.companyName,
      department: body.department,
      tags: body.tags,
    };

    // Validate required fields
    if (!createRequest.type || !createRequest.fullName) {
      return CommonErrors.badRequest('type and fullName are required');
    }

    // Call service (validation is done inside createParticipant)
    const result = await createParticipant(createRequest, user.id);

    // Handle error response
    if ('error' in result) {
      const statusCode =
        result.error.code === 'PARTICIPANT_ALREADY_EXISTS' ? 409 : 400;
      return createErrorResponse(
        result.error.code,
        result.error.message,
        statusCode,
        result.error.details
      );
    }

    // Return success response
    return createCreatedResponse({
      participant: result.data,
    });
  } catch (error) {
    return CommonErrors.internal(undefined, { originalError: error instanceof Error ? error.message : 'Unknown error' });
  }
}

