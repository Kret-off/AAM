/**
 * API Route: Prompt Scenario by ID (Admin only)
 * GET /api/scenarios/[scenarioId] - Get scenario
 * PATCH /api/scenarios/[scenarioId] - Update scenario
 * DELETE /api/scenarios/[scenarioId] - Delete scenario
 */

import { NextRequest, NextResponse } from 'next/server';
import { getScenarioById, deleteScenario } from '@/lib/scenario/service';
import { getTokenFromRequest, verifyToken } from '@/lib/auth/jwt';
import { AUTH_ERROR_CODES, AUTH_ERROR_MESSAGES } from '@/lib/auth/constants';
import { prisma } from '@/lib/prisma';
import { validateScenarioId } from '@/lib/scenario/validation';

export async function GET(
  request: NextRequest,
  { params }: { params: { scenarioId: string } }
) {
  try {
    const scenarioId = params.scenarioId;

    // Validate scenario ID format
    const idValidation = validateScenarioId(scenarioId);
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
    const result = await getScenarioById(scenarioId);

    // Handle error response
    if ('error' in result) {
      const statusCode =
        result.error.code === 'SCENARIO_NOT_FOUND' ? 404 : 500;
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
  { params }: { params: { scenarioId: string } }
) {
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

    const scenarioId = params.scenarioId;

    // Validate scenario ID format
    const idValidation = validateScenarioId(scenarioId);
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

    // Parse request body
    const body = await request.json();
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
  { params }: { params: { scenarioId: string } }
) {
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

    const scenarioId = params.scenarioId;

    // Validate scenario ID format
    const idValidation = validateScenarioId(scenarioId);
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

    // Call service
    const result = await deleteScenario(scenarioId, user.role);

    // Handle error response
    if ('error' in result) {
      const statusCode =
        result.error.code === 'SCENARIO_NOT_FOUND' ? 404
        : result.error.code === 'UNAUTHORIZED_ACCESS' ? 403
        : result.error.code === 'SCENARIO_IN_USE' ? 400
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


