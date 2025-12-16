/**
 * API Route: Prompt Scenario by ID (Admin only)
 * GET /api/scenarios/[scenarioId] - Get scenario
 * PATCH /api/scenarios/[scenarioId] - Update scenario
 * DELETE /api/scenarios/[scenarioId] - Delete scenario
 */

import { NextRequest } from 'next/server';
import { getScenarioById, deleteScenario } from '@/lib/scenario/service';
import { getTokenFromRequest, verifyToken } from '@/lib/auth/jwt';
import { AUTH_ERROR_CODES, AUTH_ERROR_MESSAGES } from '@/lib/auth/constants';
import { prisma } from '@/lib/prisma';
import { validateScenarioId } from '@/lib/scenario/validation';
import { createSuccessResponse, createErrorResponse, CommonErrors } from '@/lib/api/response-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ scenarioId: string }> }
) {
  try {
    const { scenarioId } = await params;

    // Validate scenario ID format
    const idValidation = validateScenarioId(scenarioId);
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

    // Call service
    const result = await getScenarioById(scenarioId);

    // Handle error response
    if ('error' in result) {
      const statusCode =
        result.error.code === 'SCENARIO_NOT_FOUND' ? 404 : 500;
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ scenarioId: string }> }
) {
  try {
    const { scenarioId } = await params;
    
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

    // Validate scenario ID format
    const idValidation = validateScenarioId(scenarioId);
    if (!idValidation.valid) {
      return CommonErrors.badRequest(idValidation.error!.message, { code: idValidation.error!.code });
    }

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch (error) {
      return CommonErrors.badRequest('Invalid JSON in request body');
    }

    const updateRequest = {
      meetingTypeId: body.meetingTypeId,
      name: body.name,
      systemPrompt: body.systemPrompt,
      outputSchema: body.outputSchema,
      artifactsConfig: body.artifactsConfig,
      keyterms: body.keyterms,
      isActive: body.isActive,
    };

    // Import updateScenario and UpdateScenarioRequest
    const { updateScenario } = await import('@/lib/scenario/service');
    const { UpdateScenarioRequest } = await import('@/lib/scenario/dto');

    // Call service (validation is done inside updateScenario)
    const result = await updateScenario(
      scenarioId,
      updateRequest as UpdateScenarioRequest,
      user.id,
      user.role
    );

    // Handle error response
    if ('error' in result) {
      const statusCode =
        result.error.code === 'SCENARIO_NOT_FOUND' ? 404
        : result.error.code === 'UNAUTHORIZED_ACCESS' ? 403
        : 400;
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ scenarioId: string }> }
) {
  try {
    const { scenarioId } = await params;
    
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

    // Validate scenario ID format
    const idValidation = validateScenarioId(scenarioId);
    if (!idValidation.valid) {
      return CommonErrors.badRequest(idValidation.error!.message, { code: idValidation.error!.code });
    }

    // Call service
    const result = await deleteScenario(scenarioId, user.role);

    // Handle error response
    if ('error' in result) {
      const statusCode =
        result.error.code === 'SCENARIO_NOT_FOUND' ? 404
        : result.error.code === 'UNAUTHORIZED_ACCESS' ? 403
        : result.error.code === 'SCENARIO_IN_USE' ? 400
        : 500;
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
