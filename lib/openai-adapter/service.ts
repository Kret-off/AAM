/**
 * OpenAI Adapter Module Service
 * Business logic for processing transcripts with OpenAI
 */

import OpenAI from 'openai';
import {
  ProcessTranscriptRequest,
  ProcessTranscriptResponse,
} from './dto';
import {
  OPENAI_CONSTANTS,
  OPENAI_ERROR_CODES,
  OPENAI_ERROR_MESSAGES,
} from './constants';
import { OpenAIAdapterError, OpenAIResponseMetadata } from './types';
import { validateLLMResponse, extractJSONFromResponse } from './validation';
import { saveLLMInteraction } from '../llm-interaction';

let openaiClient: OpenAI | undefined;

/**
 * Get OpenAI client instance
 */
function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

/**
 * Extract string array fields from JSON schema recursively
 */
function extractStringArrays(
  schema: unknown,
  path: string = '',
  result: string[] = []
): string[] {
  if (typeof schema !== 'object' || schema === null) {
    return result;
  }

  const schemaObj = schema as Record<string, unknown>;

  // Check if this is a string array
  if (schemaObj.type === 'array') {
    const items = schemaObj.items;
    if (
      typeof items === 'object' &&
      items !== null &&
      (items as Record<string, unknown>).type === 'string'
    ) {
      if (path) {
        result.push(path);
      }
    } else if (typeof items === 'object' && items !== null) {
      // Recursively check nested objects in arrays
      extractStringArrays(items, path + '[]', result);
    }
  }

  // Recursively process properties
  if (schemaObj.properties && typeof schemaObj.properties === 'object') {
    const properties = schemaObj.properties as Record<string, unknown>;
    for (const [key, value] of Object.entries(properties)) {
      const newPath = path ? `${path}.${key}` : key;
      extractStringArrays(value, newPath, result);
    }
  }

  return result;
}

/**
 * Extract enum fields from JSON schema recursively
 */
function extractEnums(
  schema: unknown,
  path: string = '',
  result: Array<{ path: string; values: string[] }> = []
): Array<{ path: string; values: string[] }> {
  if (typeof schema !== 'object' || schema === null) {
    return result;
  }

  const schemaObj = schema as Record<string, unknown>;

  // Check if this field has enum values
  if (Array.isArray(schemaObj.enum)) {
    const enumValues = schemaObj.enum.filter(
      (v): v is string => typeof v === 'string'
    );
    if (enumValues.length > 0 && path) {
      result.push({ path, values: enumValues });
    }
  }

  // Recursively process properties
  if (schemaObj.properties && typeof schemaObj.properties === 'object') {
    const properties = schemaObj.properties as Record<string, unknown>;
    for (const [key, value] of Object.entries(properties)) {
      const newPath = path ? `${path}.${key}` : key;
      extractEnums(value, newPath, result);
    }
  }

  // Handle array items
  if (schemaObj.type === 'array' && schemaObj.items) {
    const items = schemaObj.items;
    if (typeof items === 'object' && items !== null) {
      extractEnums(items, path + '[]', result);
    }
  }

  return result;
}

/**
 * Build prompt for LLM with dynamic instructions from outputSchema
 */
function buildPrompt(request: ProcessTranscriptRequest): string {
  const { segments, meetingMetadata, clientContextSummary, outputSchema } = request;

  // Format participants
  const participantsList = meetingMetadata.participants
    .map((p) => {
      const parts = [p.snapshotFullName];
      if (p.snapshotRoleTitle) parts.push(`(${p.snapshotRoleTitle})`);
      if (p.snapshotCompanyName) parts.push(`from ${p.snapshotCompanyName}`);
      return parts.join(' ');
    })
    .join(', ');

  // Extract string arrays and enums from schema
  const stringArrays = extractStringArrays(outputSchema);
  const enums = extractEnums(outputSchema);

  // Build dynamic instructions
  let arrayInstructions = '';
  if (stringArrays.length > 0) {
    arrayInstructions = `\nCRITICAL: Array Format Rules (MUST FOLLOW):
- ALL arrays that expect strings MUST contain ONLY plain strings, never objects or null
- Examples:
  ✅ CORRECT: "field": ["value1", "value2"]
  ❌ WRONG: "field": [{"name": "value1"}, null, "value2"]

String Array Fields (all must be string arrays):
${stringArrays.map((path) => `- ${path}: array of strings`).join('\n')}`;
  }

  let enumInstructions = '';
  if (enums.length > 0) {
    enumInstructions = `\nCRITICAL: Enum Values (MUST match exactly):
${enums
  .map((e) => `- ${e.path}: MUST be one of: ${e.values.map((v) => `"${v}"`).join(', ')}`)
  .join('\n')}`;
  }

  // Build user prompt
  const userPrompt = `Transcript Segments:
${JSON.stringify(segments, null, 2)}

Note: The transcript text is available in the 'text' field of each segment. Use segments[].text to access the full transcript content.

Meeting Metadata:
- Client: ${meetingMetadata.clientName}
- Meeting Type: ${meetingMetadata.meetingTypeName}
- Scenario: ${meetingMetadata.scenarioName}
- Participants: ${participantsList || 'None'}

${clientContextSummary ? `Client Context:\n${clientContextSummary}\n` : ''}

INSTRUCTIONS:
- Return JSON only; no markdown; no prose outside JSON
- Follow the output_schema exactly${arrayInstructions}${enumInstructions}

REMEMBER: 
- Arrays = simple string lists, NOT objects
- If a field is missing or unknown, use empty array [] or null string, NOT null in arrays
- Enum values must match exactly (case-sensitive)`;

  return userPrompt;
}

/**
 * Call OpenAI API with retry logic
 */
async function callOpenAI(
  systemPrompt: string,
  userPrompt: string,
  outputSchema: unknown,
  options?: {
    meetingId?: string;
    attemptNumber?: number;
    isRepairAttempt?: boolean;
    requestMetadata?: Record<string, unknown>;
    onAttempt?: (data: {
      attemptNumber: number;
      rawResponse?: string;
      apiResponseMetadata?: OpenAIResponseMetadata;
      error?: { code: string; message: string; details?: Record<string, unknown> };
    }) => Promise<void>;
  }
): Promise<{ content: string; metadata: OpenAIResponseMetadata }> {
  const client = getOpenAIClient();
  let lastError: Error | null = null;

  const attemptNumber = options?.attemptNumber ?? 1;
  const isRepairAttempt = options?.isRepairAttempt ?? false;

  for (let attempt = 0; attempt < OPENAI_CONSTANTS.MAX_RETRIES; attempt++) {
    const currentAttemptNumber = attemptNumber + attempt;
    const requestedAt = new Date();

    try {
      const response = await client.chat.completions.create({
        model: OPENAI_CONSTANTS.MODEL,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        temperature: OPENAI_CONSTANTS.TEMPERATURE,
        max_completion_tokens: OPENAI_CONSTANTS.MAX_COMPLETION_TOKENS,
        response_format: { type: 'json_object' }, // Force JSON response
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      const respondedAt = new Date();
      const apiResponseMetadata: OpenAIResponseMetadata = {
        usage: response.usage
          ? {
              prompt_tokens: response.usage.prompt_tokens,
              completion_tokens: response.usage.completion_tokens,
              total_tokens: response.usage.total_tokens,
            }
          : undefined,
        finish_reason: response.choices[0]?.finish_reason || undefined,
        model: response.model || undefined,
      };

      // Save successful attempt
      if (options?.onAttempt) {
        await options.onAttempt({
          attemptNumber: currentAttemptNumber,
          rawResponse: content,
          apiResponseMetadata,
        }).catch((error) => {
          // Log but don't throw - error saving should not block main process
          console.error(`[OpenAI] Failed to save interaction:`, error);
        });
      }

      return { content, metadata: apiResponseMetadata };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      const respondedAt = new Date();

      // Save failed attempt
      if (options?.onAttempt) {
        await options.onAttempt({
          attemptNumber: currentAttemptNumber,
          apiResponseMetadata: undefined,
          error: {
            code: 'API_ERROR',
            message: lastError.message,
            details: {
              originalError: lastError.message,
            },
          },
        }).catch((saveError) => {
          // Log but don't throw
          console.error(`[OpenAI] Failed to save failed interaction:`, saveError);
        });
      }

      // If it's not the last attempt, wait before retrying
      if (attempt < OPENAI_CONSTANTS.MAX_RETRIES - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }

  throw lastError || new Error('Failed to call OpenAI API');
}

/**
 * Process transcript with OpenAI and validate response
 */
export async function processTranscript(
  request: ProcessTranscriptRequest
): Promise<{ data: ProcessTranscriptResponse } | { error: OpenAIAdapterError }> {
  // Validate required fields
  if (!request.systemPrompt || !request.systemPrompt.trim()) {
    return {
      error: {
        code: OPENAI_ERROR_CODES.MISSING_SYSTEM_PROMPT,
        message: OPENAI_ERROR_MESSAGES[OPENAI_ERROR_CODES.MISSING_SYSTEM_PROMPT],
      },
    };
  }

  if (!request.outputSchema) {
    return {
      error: {
        code: OPENAI_ERROR_CODES.MISSING_OUTPUT_SCHEMA,
        message: OPENAI_ERROR_MESSAGES[OPENAI_ERROR_CODES.MISSING_OUTPUT_SCHEMA],
      },
    };
  }

  // Validate segments - must be a non-empty array
  if (!request.segments || !Array.isArray(request.segments) || request.segments.length === 0) {
    return {
      error: {
        code: OPENAI_ERROR_CODES.MISSING_TRANSCRIPT,
        message: 'Transcript segments are required and must be a non-empty array',
      },
    };
  }

  // Validate that segments contain text
  const hasText = request.segments.some(
    (segment: unknown) =>
      typeof segment === 'object' &&
      segment !== null &&
      'text' in segment &&
      typeof (segment as { text: unknown }).text === 'string' &&
      ((segment as { text: string }).text.trim().length > 0)
  );

  if (!hasText) {
    return {
      error: {
        code: OPENAI_ERROR_CODES.MISSING_TRANSCRIPT,
        message: 'Transcript segments must contain at least one segment with text',
      },
    };
  }

  try {
    // Build prompt
    const userPrompt = buildPrompt(request);
    const meetingId = request.meetingId;
    let attemptCounter = 1;

    // Prepare request metadata for logging
    const requestMetadata = {
      outputSchema: request.outputSchema,
      meetingMetadata: request.meetingMetadata,
      hasClientContext: !!request.clientContextSummary,
    };

    // Helper function to save interaction
    const createSaveHandler = (
      attemptNum: number,
      isRepair: boolean,
      userPromptText: string
    ) => {
      return async (data: {
        attemptNumber: number;
        rawResponse?: string;
        apiResponseMetadata?: OpenAIResponseMetadata;
        error?: { code: string; message: string; details?: Record<string, unknown> };
      }) => {
        if (!meetingId) return; // Skip if no meetingId provided

        const requestedAt = new Date();
        const respondedAt = data.rawResponse || data.error ? new Date() : null;

        await saveLLMInteraction({
          meetingId,
          attemptNumber: data.attemptNumber,
          isRepairAttempt: isRepair,
          systemPrompt: request.systemPrompt,
          userPrompt: userPromptText,
          model: OPENAI_CONSTANTS.MODEL,
          temperature: OPENAI_CONSTANTS.TEMPERATURE,
          maxTokens: OPENAI_CONSTANTS.MAX_COMPLETION_TOKENS,
          rawResponse: data.rawResponse || undefined,
          requestMetadata,
          apiResponseMetadata: data.apiResponseMetadata,
          errorCode: data.error?.code || undefined,
          errorMessage: data.error?.message || undefined,
          errorDetails: data.error?.details || undefined,
          requestedAt,
          respondedAt: respondedAt || undefined,
        }).catch((error) => {
          // Log but don't throw - error saving should not block main process
          console.error(`[OpenAI] Failed to save interaction:`, error);
        });
      };
    };

    // Call OpenAI API - initial attempt
    let responseResult: { content: string; metadata: OpenAIResponseMetadata };
    let responseText: string;
    try {
      responseResult = await callOpenAI(
        request.systemPrompt,
        userPrompt,
        request.outputSchema,
        {
          meetingId,
          attemptNumber: attemptCounter++,
          isRepairAttempt: false,
          requestMetadata,
          onAttempt: createSaveHandler(attemptCounter - 1, false, userPrompt),
        }
      );
      responseText = responseResult.content;
    } catch (error) {
      return {
        error: {
          code: OPENAI_ERROR_CODES.API_ERROR,
          message: OPENAI_ERROR_MESSAGES[OPENAI_ERROR_CODES.API_ERROR],
          details: {
            originalError: error instanceof Error ? error.message : 'Unknown error',
          },
        },
      };
    }

    // Extract JSON from response
    let responseData = extractJSONFromResponse(responseText);
    if (!responseData) {
      // Attempt repair: ask for JSON only
      try {
        const repairPrompt = `${userPrompt}\n\nIMPORTANT: Return valid JSON only. No markdown, no code blocks, no explanations. Just the JSON object.`;
        const repairResult = await callOpenAI(
          request.systemPrompt,
          repairPrompt,
          request.outputSchema,
          {
            meetingId,
            attemptNumber: attemptCounter++,
            isRepairAttempt: true,
            requestMetadata,
            onAttempt: createSaveHandler(attemptCounter - 1, true, repairPrompt),
          }
        );
        responseData = extractJSONFromResponse(repairResult.content);
      } catch (repairError) {
        return {
          error: {
            code: OPENAI_ERROR_CODES.REPAIR_FAILED,
            message: OPENAI_ERROR_MESSAGES[OPENAI_ERROR_CODES.REPAIR_FAILED],
            details: {
              originalError: repairError instanceof Error ? repairError.message : 'Unknown error',
            },
          },
        };
      }

      if (!responseData) {
        return {
          error: {
            code: OPENAI_ERROR_CODES.INVALID_RESPONSE,
            message: OPENAI_ERROR_MESSAGES[OPENAI_ERROR_CODES.INVALID_RESPONSE],
            details: {
              responseText: responseText.substring(0, 500), // First 500 chars for debugging
            },
          },
        };
      }
    }

    // Validate response against schema
    const validation = validateLLMResponse(responseData, request.outputSchema);
    if (!validation.valid) {
      // Attempt repair: ask for valid JSON matching schema
      try {
        // Build detailed repair prompt with enum information
        const errorDetails = validation.errors?.map((err) => {
          // If error includes enum values, format it nicely
          if (err.includes('Allowed values:')) {
            // Extract the path and allowed values for clearer formatting
            const pathMatch = err.match(/^([^:]+):/);
            const valuesMatch = err.match(/Allowed values: (.+)$/);
            if (pathMatch && valuesMatch) {
              return `Field ${pathMatch[1]}: ${valuesMatch[1]}`;
            }
            return err;
          }
          return err;
        }).join('\n') || 'Unknown validation error';
        
        const repairPrompt = `${userPrompt}\n\n❌ VALIDATION ERRORS DETECTED - YOU MUST FIX THEM:\n\n${errorDetails}\n\n🔴 CRITICAL INSTRUCTIONS:\n1. For enum fields, you MUST use EXACTLY one of the allowed values listed above\n2. Values are case-sensitive - use lowercase exactly as shown\n3. No extra spaces, no variations, no synonyms\n4. If a value is not in the allowed list, choose the closest match from the allowed values\n5. Follow the output_schema structure precisely\n6. Return ONLY valid JSON - no markdown, no code blocks, no explanations, no comments\n\nFix ALL errors and return the corrected JSON object.`;
        const repairResult = await callOpenAI(
          request.systemPrompt,
          repairPrompt,
          request.outputSchema,
          {
            meetingId,
            attemptNumber: attemptCounter++,
            isRepairAttempt: true,
            requestMetadata,
            onAttempt: createSaveHandler(attemptCounter - 1, true, repairPrompt),
          }
        );
        const repairData = extractJSONFromResponse(repairResult.content);
        if (repairData) {
          const repairValidation = validateLLMResponse(repairData, request.outputSchema);
          if (repairValidation.valid && repairValidation.data) {
            // Mark final successful interaction
            if (meetingId) {
              await saveLLMInteraction({
                meetingId,
                attemptNumber: attemptCounter - 1,
                isRepairAttempt: true,
                systemPrompt: request.systemPrompt,
                userPrompt: repairPrompt,
                model: OPENAI_CONSTANTS.MODEL,
                temperature: OPENAI_CONSTANTS.TEMPERATURE,
                maxTokens: OPENAI_CONSTANTS.MAX_COMPLETION_TOKENS,
                rawResponse: repairResult.content,
                extractedJson: repairData,
                requestMetadata,
                isValid: true,
                isFinal: true,
                apiResponseMetadata: repairResult.metadata,
                requestedAt: new Date(),
                respondedAt: new Date(),
                processedAt: new Date(),
              }).catch((error) => {
                console.error(`[OpenAI] Failed to save final interaction:`, error);
              });
            }

            return {
              data: repairValidation.data,
            };
          }
        }
      } catch (repairError) {
        // Repair failed, return validation error
      }

      return {
        error: {
          code: OPENAI_ERROR_CODES.SCHEMA_VALIDATION_FAILED,
          message: OPENAI_ERROR_MESSAGES[OPENAI_ERROR_CODES.SCHEMA_VALIDATION_FAILED],
          details: {
            validationErrors: validation.errors,
          },
        },
      };
    }

    if (!validation.data) {
      return {
        error: {
          code: OPENAI_ERROR_CODES.INVALID_RESPONSE,
          message: OPENAI_ERROR_MESSAGES[OPENAI_ERROR_CODES.INVALID_RESPONSE],
        },
      };
    }

    // Mark final successful interaction
    if (meetingId) {
      await saveLLMInteraction({
        meetingId,
        attemptNumber: 1,
        isRepairAttempt: false,
        systemPrompt: request.systemPrompt,
        userPrompt,
        model: OPENAI_CONSTANTS.MODEL,
        temperature: OPENAI_CONSTANTS.TEMPERATURE,
        maxTokens: OPENAI_CONSTANTS.MAX_COMPLETION_TOKENS,
        rawResponse: responseText,
        extractedJson: responseData,
        requestMetadata,
        isValid: true,
        isFinal: true,
        apiResponseMetadata: responseResult.metadata,
        requestedAt: new Date(),
        respondedAt: new Date(),
        processedAt: new Date(),
      }).catch((error) => {
        console.error(`[OpenAI] Failed to save final interaction:`, error);
      });
    }

    return {
      data: validation.data,
    };
  } catch (error) {
    return {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to process transcript',
        details: {
          originalError: error instanceof Error ? error.message : 'Unknown error',
        },
      },
    };
  }
}

