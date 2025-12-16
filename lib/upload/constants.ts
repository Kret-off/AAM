/**
 * Upload Module Constants
 * File size limits, allowed MIME types, and extensions
 */

export const UPLOAD_CONSTANTS = {
  MAX_FILE_SIZE_BYTES: 1200000000, // 1.2 GB
  PRESIGNED_URL_TTL_SECONDS: 3600, // 1 hour
} as const;

/**
 * Allowed MIME types for audio/video files
 * Based on Deepgram supported formats
 */
export const ALLOWED_MIME_TYPES = [
  // Audio formats
  'audio/mpeg', // MP3
  'audio/mp3',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/mp4', // M4A
  'audio/x-m4a',
  'audio/aac',
  'audio/flac',
  'audio/ogg',
  'audio/webm',
  'audio/opus',
  // Video formats
  'video/mp4',
  'video/quicktime', // MOV
  'video/x-msvideo', // AVI
  'video/webm',
  'video/x-matroska', // MKV
] as const;

/**
 * Allowed file extensions
 */
export const ALLOWED_EXTENSIONS = [
  'mp3',
  'wav',
  'm4a',
  'aac',
  'flac',
  'ogg',
  'webm',
  'opus',
  'mp4',
  'mov',
  'avi',
  'mkv',
] as const;

export const UPLOAD_ERROR_CODES = {
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  INVALID_MIME_TYPE: 'INVALID_MIME_TYPE',
  INVALID_FILE_EXTENSION: 'INVALID_FILE_EXTENSION',
  MEETING_NOT_FOUND: 'MEETING_NOT_FOUND',
  MEETING_NOT_IN_UPLOADED_STATUS: 'MEETING_NOT_IN_UPLOADED_STATUS',
  UPLOAD_BLOB_ALREADY_EXISTS: 'UPLOAD_BLOB_ALREADY_EXISTS',
  UPLOAD_BLOB_NOT_FOUND: 'UPLOAD_BLOB_NOT_FOUND',
  UNAUTHORIZED_ACCESS: 'UNAUTHORIZED_ACCESS',
  INVALID_MEETING_ID: 'INVALID_MEETING_ID',
  INVALID_FILE_NAME: 'INVALID_FILE_NAME',
  INVALID_FILE_SIZE: 'INVALID_FILE_SIZE',
} as const;

export const UPLOAD_ERROR_MESSAGES = {
  [UPLOAD_ERROR_CODES.FILE_TOO_LARGE]: 'File size exceeds maximum allowed size (1.2 GB)',
  [UPLOAD_ERROR_CODES.INVALID_MIME_TYPE]: 'File MIME type is not allowed',
  [UPLOAD_ERROR_CODES.INVALID_FILE_EXTENSION]: 'File extension is not allowed',
  [UPLOAD_ERROR_CODES.MEETING_NOT_FOUND]: 'Meeting not found',
  [UPLOAD_ERROR_CODES.MEETING_NOT_IN_UPLOADED_STATUS]: 'Meeting is not in Uploaded status',
  [UPLOAD_ERROR_CODES.UPLOAD_BLOB_ALREADY_EXISTS]: 'Upload blob already exists for this meeting',
  [UPLOAD_ERROR_CODES.UPLOAD_BLOB_NOT_FOUND]: 'Upload blob not found',
  [UPLOAD_ERROR_CODES.UNAUTHORIZED_ACCESS]: 'Unauthorized access to meeting',
  [UPLOAD_ERROR_CODES.INVALID_MEETING_ID]: 'Invalid meeting ID format',
  [UPLOAD_ERROR_CODES.INVALID_FILE_NAME]: 'Invalid file name',
  [UPLOAD_ERROR_CODES.INVALID_FILE_SIZE]: 'Invalid file size',
} as const;

export type UploadErrorCode = (typeof UPLOAD_ERROR_CODES)[keyof typeof UPLOAD_ERROR_CODES];








