/**
 * Deepgram Adapter Module DTOs
 * Request and Response Data Transfer Objects
 */

import { TranscriptSegment, Keyterm } from './types';

export interface TranscribeRequest {
  fileUrl?: string; // S3/MinIO URL or presigned URL (legacy, optional)
  fileBuffer?: Buffer; // File as Buffer (new approach)
  language?: string; // Optional language hint
  keyterms?: string[]; // Keyterms for Deepgram Keyterm Prompting to improve transcription accuracy
}

export interface TranscribeResponse {
  transcriptText: string;
  segments: TranscriptSegment[];
  keyterms: Keyterm[];
  language: string;
  duration: number;
}

