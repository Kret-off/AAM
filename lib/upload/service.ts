/**
 * Upload Module Service
 * Business logic for file upload operations
 */

import { MeetingStatus } from '@prisma/client';
import {
  RequestPresignedUrlRequest,
  PresignedUrlResponse,
  CompleteUploadRequest,
  CompleteUploadResponse,
} from './dto';
import { UploadServiceError } from './types';
import {
  UPLOAD_ERROR_CODES,
  UPLOAD_ERROR_MESSAGES,
  UPLOAD_CONSTANTS,
} from './constants';
import { validateFileUpload, validateMeetingId } from './validation';
import { generatePresignedUploadUrl, generateStoragePath } from './s3-client';
import { prisma } from '../prisma';
import { enqueueProcessingJob } from '../orchestrator/queue';
import { checkOwnerAccess } from '../meeting/rbac';
import { generateShortId } from '../db/id-generator';

/**
 * Request presigned URL for file upload
 */
export async function requestPresignedUrl(
  meetingId: string,
  userId: string,
  data: RequestPresignedUrlRequest
): Promise<{ data: PresignedUrlResponse } | { error: UploadServiceError }> {
  // Validate meeting ID
  const meetingIdValidation = validateMeetingId(meetingId);
  if (!meetingIdValidation.valid) {
    return {
      error: {
        code: meetingIdValidation.error!.code,
        message: meetingIdValidation.error!.message,
      },
    };
  }

  // Check owner access (only owner can upload)
  const accessCheck = await checkOwnerAccess(meetingId, userId);
  if (!accessCheck.allowed) {
    return {
      error: {
        code: accessCheck.error!.code,
        message: accessCheck.error!.message,
      },
    };
  }

  // Validate file
  const fileValidation = validateFileUpload(data.fileName, data.fileSize, data.mimeType);
  if (!fileValidation.valid) {
    return {
      error: {
        code: fileValidation.error!.code,
        message: fileValidation.error!.message,
      },
    };
  }

  try {
    // Check meeting exists and is in Uploaded status
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      select: {
        id: true,
        status: true,
        uploadBlob: {
          select: { id: true },
        },
      },
    });

    if (!meeting) {
      return {
        error: {
          code: UPLOAD_ERROR_CODES.MEETING_NOT_FOUND,
          message: UPLOAD_ERROR_MESSAGES[UPLOAD_ERROR_CODES.MEETING_NOT_FOUND],
        },
      };
    }

    if (meeting.status !== 'Uploaded') {
      return {
        error: {
          code: UPLOAD_ERROR_CODES.MEETING_NOT_IN_UPLOADED_STATUS,
          message: UPLOAD_ERROR_MESSAGES[UPLOAD_ERROR_CODES.MEETING_NOT_IN_UPLOADED_STATUS],
        },
      };
    }

    // Check if upload blob already exists
    if (meeting.uploadBlob) {
      return {
        error: {
          code: UPLOAD_ERROR_CODES.UPLOAD_BLOB_ALREADY_EXISTS,
          message: UPLOAD_ERROR_MESSAGES[UPLOAD_ERROR_CODES.UPLOAD_BLOB_ALREADY_EXISTS],
        },
      };
    }

    // Generate storage path
    const storagePath = generateStoragePath(meetingId, data.fileName);

    // Generate presigned URL
    const uploadUrl = await generatePresignedUploadUrl(storagePath, data.mimeType);

    // Calculate expiration time
    const expiresAt = new Date(Date.now() + UPLOAD_CONSTANTS.PRESIGNED_URL_TTL_SECONDS * 1000);

    // Create UploadBlob record
    const uploadBlobId = await generateShortId('upload_blob');
    await prisma.uploadBlob.create({
      data: {
        id: uploadBlobId,
        meetingId,
        originalFilename: data.fileName,
        mimeType: data.mimeType,
        sizeBytes: BigInt(data.fileSize),
        storagePath,
        expiresAt,
      },
    });

    return {
      data: {
        uploadUrl,
        storagePath,
        expiresAt: expiresAt.toISOString(),
      },
    };
  } catch (error) {
    return {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to generate presigned URL',
        details: { originalError: error instanceof Error ? error.message : 'Unknown error' },
      },
    };
  }
}

/**
 * Complete upload and enqueue processing job
 */
export async function completeUpload(
  meetingId: string,
  userId: string,
  data: CompleteUploadRequest
): Promise<{ data: CompleteUploadResponse } | { error: UploadServiceError }> {
  // Validate meeting ID
  const meetingIdValidation = validateMeetingId(meetingId);
  if (!meetingIdValidation.valid) {
    return {
      error: {
        code: meetingIdValidation.error!.code,
        message: meetingIdValidation.error!.message,
      },
    };
  }

  // Check owner access
  const accessCheck = await checkOwnerAccess(meetingId, userId);
  if (!accessCheck.allowed) {
    return {
      error: {
        code: accessCheck.error!.code,
        message: accessCheck.error!.message,
      },
    };
  }

  try {
    // Find upload blob
    const uploadBlob = await prisma.uploadBlob.findFirst({
      where: {
        meetingId,
        storagePath: data.storagePath,
        deletedAt: null,
      },
      select: {
        id: true,
        meetingId: true,
        meeting: {
          select: {
            status: true,
          },
        },
      },
    });

    if (!uploadBlob) {
      return {
        error: {
          code: UPLOAD_ERROR_CODES.UPLOAD_BLOB_NOT_FOUND,
          message: UPLOAD_ERROR_MESSAGES[UPLOAD_ERROR_CODES.UPLOAD_BLOB_NOT_FOUND],
        },
      };
    }

    // Verify meeting is in Uploaded status
    if (uploadBlob.meeting.status !== 'Uploaded') {
      return {
        error: {
          code: UPLOAD_ERROR_CODES.MEETING_NOT_IN_UPLOADED_STATUS,
          message: UPLOAD_ERROR_MESSAGES[UPLOAD_ERROR_CODES.MEETING_NOT_IN_UPLOADED_STATUS],
        },
      };
    }

    // Enqueue processing job
    await enqueueProcessingJob(meetingId);

    return {
      data: {
        success: true,
        meetingId,
      },
    };
  } catch (error) {
    return {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to complete upload',
        details: { originalError: error instanceof Error ? error.message : 'Unknown error' },
      },
    };
  }
}

