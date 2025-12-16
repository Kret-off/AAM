/**
 * Upload Module S3 Client
 * S3/MinIO client configuration and presigned URL generation
 */

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { UPLOAD_CONSTANTS } from './constants';

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
    forcePathStyle: true, // Required for MinIO compatibility
  });
}

/**
 * Generate presigned URL for file upload
 */
export async function generatePresignedUploadUrl(
  key: string,
  contentType: string
): Promise<string> {
  const s3Client = getS3Client();
  const bucketName = process.env.S3_BUCKET_NAME;

  if (!bucketName) {
    throw new Error('S3_BUCKET_NAME environment variable is not set');
  }

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: contentType,
  });

  const url = await getSignedUrl(s3Client, command, {
    expiresIn: UPLOAD_CONSTANTS.PRESIGNED_URL_TTL_SECONDS,
  });

  return url;
}

/**
 * Generate storage path/key for uploaded file
 */
export function generateStoragePath(meetingId: string, fileName: string): string {
  const timestamp = Date.now();
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `meetings/${meetingId}/${timestamp}_${sanitizedFileName}`;
}

/**
 * Delete file from S3
 */
export async function deleteFileFromS3(key: string): Promise<void> {
  const s3Client = getS3Client();
  const bucketName = process.env.S3_BUCKET_NAME;

  if (!bucketName) {
    throw new Error('S3_BUCKET_NAME environment variable is not set');
  }

  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  await s3Client.send(command);
}

/**
 * Check if file exists in S3
 */
export async function checkFileExists(key: string): Promise<boolean> {
  const s3Client = getS3Client();
  const bucketName = process.env.S3_BUCKET_NAME;

  if (!bucketName) {
    throw new Error('S3_BUCKET_NAME environment variable is not set');
  }

  try {
    const command = new HeadObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    await s3Client.send(command);
    return true;
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'NotFound') {
      return false;
    }
    throw error;
  }
}

/**
 * Ensure bucket exists, create if it doesn't
 */
export async function ensureBucketExists(): Promise<void> {
  const s3Client = getS3Client();
  const bucketName = process.env.S3_BUCKET_NAME;

  if (!bucketName) {
    throw new Error('S3_BUCKET_NAME environment variable is not set');
  }

  try {
    // Check if bucket exists
    const headCommand = new HeadBucketCommand({
      Bucket: bucketName,
    });

    await s3Client.send(headCommand);
    // Bucket exists
    return;
  } catch (error: unknown) {
    // Bucket doesn't exist, create it
    if (error && typeof error === 'object' && 'name' in error && error.name === 'NotFound') {
      const createCommand = new CreateBucketCommand({
        Bucket: bucketName,
      });

      await s3Client.send(createCommand);
      return;
    }
    throw error;
  }
}

