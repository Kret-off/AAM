/**
 * Deepgram Adapter Module Constants
 * API configuration and error codes
 */

export const DEEPGRAM_CONSTANTS = {
  MODEL: 'nova-3', // Deepgram Nova-3 model
  MAX_RETRIES: 3,
  TIMEOUT_MS: 300000, // 5 minutes for large files
} as const;

export const DEEPGRAM_ERROR_CODES = {
  API_ERROR: 'API_ERROR',
  INVALID_AUTH: 'INVALID_AUTH',
  INVALID_RESPONSE: 'INVALID_RESPONSE',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  TRANSCRIPTION_FAILED: 'TRANSCRIPTION_FAILED',
  INVALID_INPUT: 'INVALID_INPUT',
  TIMEOUT: 'TIMEOUT',
} as const;

export const DEEPGRAM_ERROR_MESSAGES = {
  [DEEPGRAM_ERROR_CODES.API_ERROR]: 'Deepgram API error',
  [DEEPGRAM_ERROR_CODES.INVALID_AUTH]: 'Invalid Deepgram API credentials. Please check your DEEPGRAM_API_KEY in .env file',
  [DEEPGRAM_ERROR_CODES.INVALID_RESPONSE]: 'Invalid response from Deepgram',
  [DEEPGRAM_ERROR_CODES.FILE_NOT_FOUND]: 'File not found in storage',
  [DEEPGRAM_ERROR_CODES.TRANSCRIPTION_FAILED]: 'Transcription failed',
  [DEEPGRAM_ERROR_CODES.INVALID_INPUT]: 'Invalid input parameters',
  [DEEPGRAM_ERROR_CODES.TIMEOUT]: 'Transcription timeout',
} as const;

export type DeepgramErrorCode = (typeof DEEPGRAM_ERROR_CODES)[keyof typeof DEEPGRAM_ERROR_CODES];

