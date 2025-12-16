/**
 * OpenAI Adapter Module Types
 * TypeScript type definitions
 */

export interface OpenAIAdapterError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Transcript segment structure
 */
export interface TranscriptSegment {
  start: number;
  end: number;
  speaker?: string | number;
  text: string;
}

/**
 * Meeting metadata for LLM context
 */
export interface MeetingMetadata {
  clientName: string;
  meetingTypeName: string;
  scenarioName: string;
  participants: Array<{
    snapshotFullName: string;
    snapshotRoleTitle: string | null;
    snapshotCompanyName: string | null;
    snapshotDepartment: string | null;
  }>;
}

/**
 * Validated LLM response structure
 * Structure is defined by outputSchema - no hardcoded wrapper
 */
export type ValidatedLLMResponse = Record<string, unknown>;

/**
 * OpenAI API response metadata
 */
export interface OpenAIResponseMetadata {
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  finish_reason?: string;
  model?: string;
}

