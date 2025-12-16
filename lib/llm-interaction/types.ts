/**
 * LLM Interaction Module Types
 * TypeScript type definitions for LLM interaction logging
 */

import { LLMInteraction } from '@prisma/client';

/**
 * Data for saving LLM interaction
 */
export interface SaveLLMInteractionData {
  meetingId: string;
  attemptNumber: number;
  isRepairAttempt: boolean;
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  rawResponse?: string;
  extractedJson?: unknown;
  requestMetadata?: Record<string, unknown>;
  isValid?: boolean;
  validationErrors?: string[];
  isFinal?: boolean;
  apiResponseMetadata?: {
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
    finish_reason?: string;
    model?: string;
  };
  errorCode?: string;
  errorMessage?: string;
  errorDetails?: Record<string, unknown>;
  requestedAt?: Date;
  respondedAt?: Date;
  processedAt?: Date;
}

/**
 * LLM Interaction with full details
 */
export type LLMInteractionWithDetails = LLMInteraction;








