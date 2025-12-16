/**
 * API Route: Request Presigned URL for Upload
 * POST /api/meetings/[meetingId]/upload/presigned-url
 */

import { NextRequest, NextResponse } from 'next/server';
import { requestPresignedUrl } from '@/lib/upload/service';
import { RequestPresignedUrlRequest } from '@/lib/upload/dto';
import { getTokenFromRequest, verifyToken } from '@/lib/auth/jwt';
import { AUTH_ERROR_CODES, AUTH_ERROR_MESSAGES } from '@/lib/auth/constants';
import { prisma } from '@/lib/prisma';
import { validateMeetingId } from '@/lib/meeting/validation';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  try {
    const { meetingId } = await params;

    // Validate meeting ID format
    const idValidation = validateMeetingId(meetingId);
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

    const userId = user.id;

    // Parse request body
    const body = await request.json();
    const uploadRequest: RequestPresignedUrlRequest = {
      fileName: body.fileName,
      fileSize: body.fileSize,
      mimeType: body.mimeType,
    };

    // Validate required fields
    if (!uploadRequest.fileName || !uploadRequest.fileSize || !uploadRequest.mimeType) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_REQUEST',
            message: 'fileName, fileSize, and mimeType are required',
          },
        },
        { status: 400 }
      );
    }

    // Call service
    const result = await requestPresignedUrl(meetingId, userId, uploadRequest);

    if ('error' in result) {
      const statusCode =
        result.error.code === 'UNAUTHORIZED_ACCESS' ||
        result.error.code === 'MEETING_NOT_FOUND' ||
        result.error.code === 'UPLOAD_BLOB_ALREADY_EXISTS'
          ? 403
          : result.error.code === 'INVALID_MEETING_ID' ||
            result.error.code === 'INVALID_FILE_NAME' ||
            result.error.code === 'INVALID_FILE_SIZE' ||
            result.error.code === 'INVALID_MIME_TYPE' ||
            result.error.code === 'INVALID_FILE_EXTENSION' ||
            result.error.code === 'FILE_TOO_LARGE'
          ? 400
          : 500;

      return NextResponse.json({ error: result.error }, { status: statusCode });
    }

    return NextResponse.json({ data: result.data }, { status: 200 });
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

