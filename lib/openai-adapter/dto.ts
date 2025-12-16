/**
 * OpenAI Adapter Module DTOs
 * Request and Response Data Transfer Objects
 */

import { MeetingMetadata, ValidatedLLMResponse } from './types';

export interface ProcessTranscriptRequest {
  meetingId?: string; // Optional: for logging LLM interactions
  transcriptText?: string; // Optional: deprecated, use segments[].text instead
  segments: unknown; // JSON from database - array of segments with text, start, end, speaker
  keyterms?: unknown; // JSON from database
  language: string;
  systemPrompt: string;
  outputSchema: unknown; // JSON schema from database
  meetingMetadata: MeetingMetadata;
  clientContextSummary: string | null;
}

/**
 * ProcessTranscriptResponse structure is defined by outputSchema
 * No hardcoded wrapper - response matches outputSchema exactly
 */
export type ProcessTranscriptResponse = Record<string, unknown>;

