/**
 * Orchestrator Module Types
 * TypeScript type definitions
 */

export interface OrchestratorError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ProcessingContext {
  meetingId: string;
  lockKey: string;
}








