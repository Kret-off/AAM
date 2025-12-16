/**
 * Upload Module DTOs
 * Request and Response Data Transfer Objects
 */

export interface RequestPresignedUrlRequest {
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export interface PresignedUrlResponse {
  uploadUrl: string;
  storagePath: string;
  expiresAt: string;
}

export interface CompleteUploadRequest {
  storagePath: string;
}

export interface CompleteUploadResponse {
  success: boolean;
  meetingId: string;
}








