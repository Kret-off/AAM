/**
 * OpenAI Adapter Module Constants
 * Model configuration and error codes
 */

export const OPENAI_CONSTANTS = {
  MODEL: 'gpt-5.1', // GPT-5.1 model
  MAX_RETRIES: 3,
  REPAIR_ATTEMPTS: 1, // Only one repair pass as per rules
  TEMPERATURE: 0.3, // Lower temperature for more deterministic JSON output
  MAX_COMPLETION_TOKENS: 8000, // Sufficient for JSON artifacts
} as const;

export const OPENAI_ERROR_CODES = {
  INVALID_RESPONSE: 'INVALID_RESPONSE',
  SCHEMA_VALIDATION_FAILED: 'SCHEMA_VALIDATION_FAILED',
  REPAIR_FAILED: 'REPAIR_FAILED',
  API_ERROR: 'API_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_SYSTEM_PROMPT: 'MISSING_SYSTEM_PROMPT',
  MISSING_OUTPUT_SCHEMA: 'MISSING_OUTPUT_SCHEMA',
  MISSING_TRANSCRIPT: 'MISSING_TRANSCRIPT',
} as const;

export const OPENAI_ERROR_MESSAGES = {
  [OPENAI_ERROR_CODES.INVALID_RESPONSE]: 'OpenAI returned invalid response',
  [OPENAI_ERROR_CODES.SCHEMA_VALIDATION_FAILED]: 'Response does not match output schema',
  [OPENAI_ERROR_CODES.REPAIR_FAILED]: 'Failed to repair invalid JSON response',
  [OPENAI_ERROR_CODES.API_ERROR]: 'OpenAI API error',
  [OPENAI_ERROR_CODES.INVALID_INPUT]: 'Invalid input parameters',
  [OPENAI_ERROR_CODES.MISSING_SYSTEM_PROMPT]: 'System prompt is required',
  [OPENAI_ERROR_CODES.MISSING_OUTPUT_SCHEMA]: 'Output schema is required',
  [OPENAI_ERROR_CODES.MISSING_TRANSCRIPT]: 'Transcript is required',
} as const;

export type OpenAIErrorCode = (typeof OPENAI_ERROR_CODES)[keyof typeof OPENAI_ERROR_CODES];

/**
 * Required wrapper structure for LLM output
 */
export const REQUIRED_WRAPPER_STRUCTURE = {
  artifacts: {},
  quality: {
    missing_data_items: [],
    notes: [],
  },
} as const;

