/**
 * Orchestrator Module Constants
 * Queue names, retry parameters, and lock settings
 */

export const ORCHESTRATOR_CONSTANTS = {
  QUEUE_NAME: 'processing',
  LOCK_TTL_MS: 300000, // 5 minutes lock timeout
  LOCK_RETRY_DELAY_MS: 1000, // 1 second between lock retries
  MAX_LOCK_RETRIES: 10,
  CLEANUP_TTL_HOURS: 24,
  JOB_ATTEMPTS: 3,
  JOB_BACKOFF_DELAY: 2000, // 2 seconds initial backoff
} as const;

export const AUTO_RETRY_CONSTANTS = {
  MAX_AUTO_RETRIES: 3, // Максимум автоматических попыток
  INITIAL_DELAY_MINUTES: 5, // Первая задержка: 5 минут
  MAX_DELAY_MINUTES: 60, // Максимальная задержка: 60 минут
  EXPONENTIAL_BASE: 2, // База для экспоненциальной задержки
} as const;

export const ORCHESTRATOR_ERROR_CODES = {
  MEETING_NOT_FOUND: 'MEETING_NOT_FOUND',
  LOCK_ACQUISITION_FAILED: 'LOCK_ACQUISITION_FAILED',
  INVALID_STATUS: 'INVALID_STATUS',
  TRANSCRIPT_ALREADY_EXISTS: 'TRANSCRIPT_ALREADY_EXISTS',
  ARTIFACTS_ALREADY_EXISTS: 'ARTIFACTS_ALREADY_EXISTS',
  UPLOAD_BLOB_NOT_FOUND: 'UPLOAD_BLOB_NOT_FOUND',
  FILE_DELETION_FAILED: 'FILE_DELETION_FAILED',
} as const;

export const ORCHESTRATOR_ERROR_MESSAGES = {
  [ORCHESTRATOR_ERROR_CODES.MEETING_NOT_FOUND]: 'Meeting not found',
  [ORCHESTRATOR_ERROR_CODES.LOCK_ACQUISITION_FAILED]: 'Failed to acquire lock for meeting',
  [ORCHESTRATOR_ERROR_CODES.INVALID_STATUS]: 'Meeting is in invalid status for processing',
  [ORCHESTRATOR_ERROR_CODES.TRANSCRIPT_ALREADY_EXISTS]: 'Transcript already exists',
  [ORCHESTRATOR_ERROR_CODES.ARTIFACTS_ALREADY_EXISTS]: 'Artifacts already exist',
  [ORCHESTRATOR_ERROR_CODES.UPLOAD_BLOB_NOT_FOUND]: 'Upload blob not found',
  [ORCHESTRATOR_ERROR_CODES.FILE_DELETION_FAILED]: 'Failed to delete file from storage',
} as const;

export type OrchestratorErrorCode = (typeof ORCHESTRATOR_ERROR_CODES)[keyof typeof ORCHESTRATOR_ERROR_CODES];

