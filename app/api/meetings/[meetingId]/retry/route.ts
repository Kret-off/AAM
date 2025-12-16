/**
 * API Route: Retry Meeting Processing
 * POST /api/meetings/[meetingId]/retry
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest, verifyToken } from '@/lib/auth/jwt';
import { AUTH_ERROR_CODES, AUTH_ERROR_MESSAGES } from '@/lib/auth/constants';
import { prisma } from '@/lib/prisma';
import { checkOwnerAccess } from '@/lib/meeting/rbac';
import { enqueueProcessingJob } from '@/lib/orchestrator/queue';
import { MeetingStatus } from '@prisma/client';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  try {
    const { meetingId } = await params;

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

    // Check owner access
    const ownerCheck = await checkOwnerAccess(meetingId, user.id);
    if (!ownerCheck.allowed) {
      return NextResponse.json(
        {
          error: {
            code: ownerCheck.error!.code,
            message: ownerCheck.error!.message,
          },
        },
        { status: ownerCheck.error!.code === 'MEETING_NOT_FOUND' ? 404 : 403 }
      );
    }

    // Get meeting with upload blob and transcript
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      select: {
        id: true,
        status: true,
        uploadBlob: {
          select: {
            id: true,
            deletedAt: true,
          },
        },
        transcript: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!meeting) {
      return NextResponse.json(
        {
          error: {
            code: 'MEETING_NOT_FOUND',
            message: 'Meeting not found',
          },
        },
        { status: 404 }
      );
    }

    // Check if status allows retry
    const allowedStatuses: MeetingStatus[] = ['Failed_Transcription', 'Failed_LLM', 'Failed_System'];
    if (!allowedStatuses.includes(meeting.status)) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_STATUS',
            message: 'Meeting status does not allow retry',
            details: {
              currentStatus: meeting.status,
              allowedStatuses,
            },
          },
        },
        { status: 400 }
      );
    }

    // Check if upload blob exists and is not deleted
    if (!meeting.uploadBlob || meeting.uploadBlob.deletedAt) {
      return NextResponse.json(
        {
          error: {
            code: 'UPLOAD_BLOB_NOT_AVAILABLE',
            message: 'Upload file is not available for retry',
          },
        },
        { status: 400 }
      );
    }

    // Determine new status based on current status
    let newStatus: MeetingStatus;
    if (meeting.status === 'Failed_Transcription') {
      newStatus = 'Uploaded';
    } else if (meeting.status === 'Failed_LLM') {
      // If transcript exists, go to LLM_Processing, otherwise start from Uploaded
      newStatus = meeting.transcript ? 'LLM_Processing' : 'Uploaded';
    } else {
      // Failed_System
      newStatus = 'Uploaded';
    }

    // Perform retry operations in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete transcript if status was Failed_Transcription
      if (meeting.status === 'Failed_Transcription' && meeting.transcript) {
        await tx.transcript.delete({
          where: { meetingId },
        });
      }

      // Clear expiresAt from upload blob
      await tx.uploadBlob.update({
        where: { meetingId },
        data: {
          expiresAt: null,
        },
      });

      // Update meeting status directly in transaction
      await tx.meeting.update({
        where: { id: meetingId },
        data: {
          status: newStatus,
        },
      });
    });

    // Enqueue processing job
    await enqueueProcessingJob(meetingId);

    // Return success response
    return NextResponse.json(
      {
        data: {
          success: true,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Retry] Error processing retry request:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to process retry request',
          details: { originalError: error instanceof Error ? error.message : 'Unknown error' },
        },
      },
      { status: 500 }
    );
  }
}

