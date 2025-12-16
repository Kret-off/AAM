/**
 * Deepgram Adapter Module Types
 * TypeScript type definitions
 */

export interface DeepgramAdapterError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Transcript segment from Deepgram
 */
export interface TranscriptSegment {
  start: number;
  end: number;
  speaker?: number;
  text: string;
}

/**
 * Keyterm from Deepgram
 */
export interface Keyterm {
  text: string;
  start: number;
  end: number;
  confidence: number;
}








