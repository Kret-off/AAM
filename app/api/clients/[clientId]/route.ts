/**
 * API Route: Client by ID
 * GET /api/clients/[clientId] - Get client
 * PATCH /api/clients/[clientId] - Update client
 */

import { NextRequest } from 'next/server';
import { getClientDetail, updateClient } from '@/lib/client-kb/service';
import { getMeetings } from '@/lib/meeting/service';
import { getTokenFromRequest, verifyToken } from '@/lib/auth/jwt';
import { AUTH_ERROR_CODES, AUTH_ERROR_MESSAGES } from '@/lib/auth/constants';
import { prisma } from '@/lib/prisma';
import { validateClientId } from '@/lib/client-kb/validation';
import { UpdateClientRequest } from '@/lib/client-kb/dto';
import { createSuccessResponse, createErrorResponse, CommonErrors } from '@/lib/api/response-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;

    // Validate client ID format
    const idValidation = validateClientId(clientId);
    if (!idValidation.valid) {
      return CommonErrors.badRequest(idValidation.error!.message, { code: idValidation.error!.code });
    }
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

    // Get user from database to verify active status
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

    // Call service to get client detail with ownership check
    const result = await getClientDetail(clientId, user.id, user.role);

    // Handle error response
    if ('error' in result) {
      const statusCode =
        result.error.code === 'CLIENT_NOT_FOUND' ? 404 :
        result.error.code === 'INVALID_CLIENT_ID' ? 400 :
        result.error.code === 'UNAUTHORIZED_ACCESS' ? 403 : 500;
      return createErrorResponse(
        result.error.code,
        result.error.message,
        statusCode,
        result.error.details
      );
    }

    // Load meetings for this client with RBAC
    const meetingsResult = await getMeetings(
      {
        filter: {
          clientId: clientId,
        },
        page: 1,
        pageSize: 100, // Get all meetings for the client
      },
      user.id,
      user.role
    );

    // Add meetings to response (even if there's an error, we still return client data)
    const clientData = result.data;
    if ('data' in meetingsResult) {
      clientData.meetings = meetingsResult.data.items;
    } else {
      clientData.meetings = [];
    }

    // Return success response
    return createSuccessResponse(clientData);
  } catch (error) {
    return CommonErrors.internal(undefined, { originalError: error instanceof Error ? error.message : 'Unknown error' });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;

    // Validate client ID format
    const idValidation = validateClientId(clientId);
    if (!idValidation.valid) {
      return CommonErrors.badRequest(idValidation.error!.message, { code: idValidation.error!.code });
    }

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

    // Get user from database to verify active status
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

    // Parse request body
    let updateData: UpdateClientRequest;
    try {
      updateData = await request.json();
    } catch (parseError) {
      return CommonErrors.badRequest('Invalid JSON in request body');
    }

    // Validate that at least one field is provided
    if (updateData.name === undefined && updateData.contextSummary === undefined) {
      return CommonErrors.badRequest('At least one field (name or contextSummary) must be provided');
    }

    // Call service to update client
    const result = await updateClient(clientId, updateData, user.id, user.role);

    // Handle error response
    if ('error' in result) {
      const statusCode =
        result.error.code === 'CLIENT_NOT_FOUND' ? 404 :
        result.error.code === 'INVALID_CLIENT_ID' ? 400 :
        result.error.code === 'UNAUTHORIZED_ACCESS' ? 403 : 500;
      return createErrorResponse(
        result.error.code,
        result.error.message,
        statusCode,
        result.error.details
      );
    }

    // Return success response
    return createSuccessResponse(result.data);
  } catch (error) {
    return CommonErrors.internal(undefined, { originalError: error instanceof Error ? error.message : 'Unknown error' });
  }
}

