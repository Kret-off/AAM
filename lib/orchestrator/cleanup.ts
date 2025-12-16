/**
 * Orchestrator Cleanup Module
 * Handles UploadBlob cleanup (immediate delete on success, TTL on failure)
 */

import { prisma } from '../prisma';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { ORCHESTRATOR_CONSTANTS } from './constants';

/**
 * Get S3 client instance
 */
function getS3Client(): S3Client {
  const endpoint = process.env.S3_ENDPOINT;
  const region = process.env.S3_REGION || 'us-east-1';
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error('S3 configuration is missing. Please check environment variables.');
  }

  return new S3Client({
    endpoint,
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    forcePathStyle: true,
  });
}

/**
 * Delete UploadBlob and file from storage
 */
export async function deleteUploadBlob(
  meetingId: string,
  immediate: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const uploadBlob = await prisma.uploadBlob.findUnique({
      where: { meetingId },
      select: {
        id: true,
        storagePath: true,
        deletedAt: true,
      },
    });

    if (!uploadBlob) {
      return { success: true }; // Already deleted or doesn't exist
    }

    if (uploadBlob.deletedAt) {
      return { success: true }; // Already marked as deleted
    }

    if (immediate) {
      // Delete file from S3 immediately
      try {
        const s3Client = getS3Client();
        const bucketName = process.env.S3_BUCKET_NAME;

        if (!bucketName) {
          throw new Error('S3_BUCKET_NAME environment variable is not set');
        }

        await s3Client.send(
          new DeleteObjectCommand({
            Bucket: bucketName,
            Key: uploadBlob.storagePath,
          })
        );
      } catch (error) {
        // Log error but continue with DB cleanup
        console.error('Failed to delete file from S3:', error);
      }

      // Mark as deleted in database
      await prisma.uploadBlob.update({
        where: { id: uploadBlob.id },
        data: {
          deletedAt: new Date(),
        },
      });
    } else {
      // Set TTL for deletion (24 hours)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + ORCHESTRATOR_CONSTANTS.CLEANUP_TTL_HOURS);

      await prisma.uploadBlob.update({
        where: { id: uploadBlob.id },
        data: {
          expiresAt,
        },
      });
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Cleanup expired UploadBlobs (TTL cleanup worker)
 */
export async function cleanupExpiredUploadBlobs(): Promise<{
  deleted: number;
  errors: number;
}> {
  let deleted = 0;
  let errors = 0;

  try {
    const expiredBlobs = await prisma.uploadBlob.findMany({
      where: {
        expiresAt: {
          lte: new Date(),
        },
        deletedAt: null,
      },
      select: {
        id: true,
        meetingId: true,
        storagePath: true,
      },
    });

    const s3Client = getS3Client();
    const bucketName = process.env.S3_BUCKET_NAME;

    if (!bucketName) {
      throw new Error('S3_BUCKET_NAME environment variable is not set');
    }

    for (const blob of expiredBlobs) {
      try {
        // Delete file from S3
        await s3Client.send(
          new DeleteObjectCommand({
            Bucket: bucketName,
            Key: blob.storagePath,
          })
        );

        // Mark as deleted in database
        await prisma.uploadBlob.update({
          where: { id: blob.id },
          data: {
            deletedAt: new Date(),
          },
        });

        deleted++;
      } catch (error) {
        console.error(`Failed to cleanup blob ${blob.id}:`, error);
        errors++;
      }
    }

    return { deleted, errors };
  } catch (error) {
    console.error('Failed to cleanup expired upload blobs:', error);
    return { deleted, errors: errors + 1 };
  }
}








