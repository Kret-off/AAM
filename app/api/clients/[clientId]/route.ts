/**
 * API Route: Client by ID
 * GET /api/clients/[clientId] - Get client
 * PATCH /api/clients/[clientId] - Update client
 */

import { NextRequest, NextResponse } from 'next/server';
import { getClientDetail, updateClient } from '@/lib/client-kb/service';
import { getMeetings } from '@/lib/meeting/service';
import { getTokenFromRequest, verifyToken } from '@/lib/auth/jwt';
import { AUTH_ERROR_CODES, AUTH_ERROR_MESSAGES } from '@/lib/auth/constants';
import { prisma } from '@/lib/prisma';
import { validateClientId } from '@/lib/client-kb/validation';
import { UpdateClientRequest } from '@/lib/client-kb/dto';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;

    // Validate client ID format
    const idValidation = validateClientId(clientId);
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

    // Call service to get client detail with ownership check
    const result = await getClientDetail(clientId, user.id, user.role);

    // Handle error response
    if ('error' in result) {
      const statusCode =
        result.error.code === 'CLIENT_NOT_FOUND' ? 404 :
        result.error.code === 'INVALID_CLIENT_ID' ? 400 :
        result.error.code === 'UNAUTHORIZED_ACCESS' ? 403 : 500;
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
    return NextResponse.json(
      {
        data: clientData,
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
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;

    // Validate client ID format
    const idValidation = validateClientId(clientId);
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
    let updateData: UpdateClientRequest;
    try {
      updateData = await request.json();
    } catch (parseError) {
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

    // Validate that at least one field is provided
    if (updateData.name === undefined && updateData.contextSummary === undefined) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_REQUEST',
            message: 'At least one field (name or contextSummary) must be provided',
          },
        },
        { status: 400 }
      );
    }

    // Call service to update client
    const result = await updateClient(clientId, updateData, user.id, user.role);

    // Handle error response
    if ('error' in result) {
      const statusCode =
        result.error.code === 'CLIENT_NOT_FOUND' ? 404 :
        result.error.code === 'INVALID_CLIENT_ID' ? 400 :
        result.error.code === 'UNAUTHORIZED_ACCESS' ? 403 : 500;
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

