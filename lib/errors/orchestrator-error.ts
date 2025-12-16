/**
 * Orchestrator Error Class
 * For errors occurring during meeting processing
 */

import { BaseError } from './base-error';

export class OrchestratorError extends BaseError {
  public readonly stage: 'transcription' | 'llm' | 'system';
  public readonly retryable: boolean;

  constructor(
    code: string,
    message: string,
    stage: 'transcription' | 'llm' | 'system',
    retryable: boolean = true,
    details?: Record<string, unknown>
  ) {
    super(code, message, details, true);
    this.stage = stage;
    this.retryable = retryable;
  }
}

