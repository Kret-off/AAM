/**
 * Orchestrator S3 Utilities
 * Helper functions for S3/MinIO operations
 */

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

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
 * Generate presigned URL for reading file from S3
 */
export async function generatePresignedReadUrl(key: string): Promise<string> {
  const s3Client = getS3Client();
  const bucketName = process.env.S3_BUCKET_NAME;

  if (!bucketName) {
    throw new Error('S3_BUCKET_NAME environment variable is not set');
  }

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  const url = await getSignedUrl(s3Client, command, {
    expiresIn: 3600, // 1 hour
  });

  return url;
}

/**
 * Download file from S3 as Buffer (for small files) or Readable stream (for large files)
 * @param key - S3 object key
 * @returns Buffer containing file data
 */
export async function downloadFileFromS3(key: string): Promise<Buffer> {
  const s3Client = getS3Client();
  const bucketName = process.env.S3_BUCKET_NAME;

  if (!bucketName) {
    throw new Error('S3_BUCKET_NAME environment variable is not set');
  }

  console.log(`[S3] Starting download for key: ${key}`);

  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    const response = await s3Client.send(command);

    if (!response.Body) {
      throw new Error('Empty response body from S3');
    }

    // Convert stream to Buffer
    const chunks: Buffer[] = [];
    const stream = response.Body as NodeJS.ReadableStream;

    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }

    const buffer = Buffer.concat(chunks);
    console.log(`[S3] Download completed. Size: ${buffer.length} bytes (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);

    return buffer;
  } catch (error) {
    console.error(`[S3] Error downloading file with key ${key}:`, error);
    throw error instanceof Error
      ? new Error(`Failed to download file from S3: ${error.message}`)
      : new Error('Failed to download file from S3: Unknown error');
  }
}

