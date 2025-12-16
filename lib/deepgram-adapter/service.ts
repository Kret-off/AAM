/**
 * Deepgram Adapter Module Service
 * Business logic for Deepgram transcription
 */

import { createClient } from '@deepgram/sdk';
import {
  TranscribeRequest,
  TranscribeResponse,
} from './dto';
import { DeepgramAdapterError } from './types';
import {
  DEEPGRAM_CONSTANTS,
  DEEPGRAM_ERROR_CODES,
  DEEPGRAM_ERROR_MESSAGES,
} from './constants';

let deepgramClient: ReturnType<typeof createClient> | undefined;

/**
 * Reset Deepgram client instance (useful when API key changes)
 */
export function resetDeepgramClient(): void {
  deepgramClient = undefined;
  console.log('[Deepgram] Client cache reset');
}

/**
 * Get Deepgram client instance
 */
function getDeepgramClient(): ReturnType<typeof createClient> {
  if (!deepgramClient) {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      throw new Error('DEEPGRAM_API_KEY environment variable is not set');
    }
    
    // Validate API key format - just check it's not empty
    const trimmedKey = apiKey.trim();
    if (!trimmedKey || trimmedKey.length < 10) {
      throw new Error('DEEPGRAM_API_KEY appears to be invalid (too short or empty)');
    }
    
    // Validate key format (should start with "dg_")
    if (!trimmedKey.startsWith('dg_')) {
      console.warn('[Deepgram] Warning: API key does not start with "dg_". This may indicate an invalid key format.');
    }
    
    deepgramClient = createClient(trimmedKey);
    console.log(`[Deepgram] Client created with key length: ${trimmedKey.length} characters`);
  }
  return deepgramClient;
}

/**
 * Transcribe audio/video file using Deepgram
 */
export async function transcribe(
  request: TranscribeRequest
): Promise<{ data: TranscribeResponse } | { error: DeepgramAdapterError }> {
  // Validate that either fileUrl or fileBuffer is provided
  if (!request.fileUrl && !request.fileBuffer) {
    return {
      error: {
        code: DEEPGRAM_ERROR_CODES.INVALID_INPUT,
        message: DEEPGRAM_ERROR_MESSAGES[DEEPGRAM_ERROR_CODES.INVALID_INPUT],
        details: { field: 'fileUrl or fileBuffer must be provided' },
      },
    };
  }

  if (request.fileUrl && !request.fileUrl.trim()) {
    return {
      error: {
        code: DEEPGRAM_ERROR_CODES.INVALID_INPUT,
        message: DEEPGRAM_ERROR_MESSAGES[DEEPGRAM_ERROR_CODES.INVALID_INPUT],
        details: { field: 'fileUrl' },
      },
    };
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < DEEPGRAM_CONSTANTS.MAX_RETRIES; attempt++) {
    try {
      const client = getDeepgramClient();

      // Configure transcription options
      // Always set language explicitly to prevent auto-detection issues
      const languageCode = request.language || 'ru';
      const options: {
        model: string;
        punctuate: boolean;
        diarize: boolean;
        paragraphs: boolean;
        utterances: boolean;
        language: string;
        keyterm?: string[];
      } = {
        model: DEEPGRAM_CONSTANTS.MODEL,
        punctuate: true,
        diarize: true, // Speaker diarization
        paragraphs: false,
        utterances: true, // Get segments
        language: languageCode, // Always set language explicitly
      };

      // Add keyterms if provided (for Deepgram Keyterm Prompting)
      if (request.keyterms && request.keyterms.length > 0) {
        options.keyterm = request.keyterms;
      }
      
      console.log(`[Deepgram] Language parameter: ${languageCode}`);

      // Start transcription - use fileBuffer if provided, otherwise use fileUrl
      let result;
      let error;

      if (request.fileBuffer) {
        // Use transcribeFile for direct file upload
        console.log(`[Deepgram] Starting transcription (attempt ${attempt + 1}/${DEEPGRAM_CONSTANTS.MAX_RETRIES})`);
        console.log(`[Deepgram] File size: ${request.fileBuffer.length} bytes (${(request.fileBuffer.length / 1024 / 1024).toFixed(2)} MB)`);
        console.log(`[Deepgram] Options:`, JSON.stringify(options, null, 2));
        
        const response = await client.listen.prerecorded.transcribeFile(
          request.fileBuffer,
          options
        );
        result = response.result;
        error = response.error;
        
        if (error) {
          console.error(`[Deepgram] Transcription error on attempt ${attempt + 1}:`, {
            message: error.message,
            type: error.type,
            code: (error as any).code,
            status: (error as any).status,
            fullError: error,
          });
        } else {
          console.log(`[Deepgram] Transcription successful on attempt ${attempt + 1}`);
        }
      } else if (request.fileUrl) {
        // Use transcribeUrl for URL-based transcription (backward compatibility)
        const response = await client.listen.prerecorded.transcribeUrl(
          { url: request.fileUrl },
          options
        );
        result = response.result;
        error = response.error;
      } else {
        throw new Error('Neither fileBuffer nor fileUrl provided');
      }

      if (error) {
        const errorCode = (error as any).code || 'Unknown';
        const errorMessage = error.message || 'Unknown error';
        
        // Check for authentication errors
        const isAuthError = 
          errorCode === 'INVALID_AUTH' || 
          errorMessage.toLowerCase().includes('invalid credentials') ||
          errorMessage.toLowerCase().includes('authentication') ||
          errorMessage.toLowerCase().includes('unauthorized');
        
        const errorDetails = {
          message: errorMessage,
          type: error.type || 'Unknown',
          code: errorCode,
          status: (error as any).status || 'Unknown',
          statusText: (error as any).statusText || 'Unknown',
          isAuthError,
          fullError: JSON.stringify(error, null, 2),
        };
        console.error('[Deepgram] API Error Details:', errorDetails);
        
        // Provide more helpful error message for auth errors
        if (isAuthError) {
          // Reset client cache on auth error - key might have changed
          console.warn('[Deepgram] Authentication error detected, resetting client cache');
          resetDeepgramClient();
          
          const apiKey = process.env.DEEPGRAM_API_KEY;
          const keyInfo = apiKey 
            ? `Key length: ${apiKey.trim().length} chars, starts with "dg_": ${apiKey.trim().startsWith('dg_')}`
            : 'Key not found in environment';
          
          const authErrorMsg = `Deepgram API authentication failed: ${errorMessage}. ` +
            `Please verify your DEEPGRAM_API_KEY in .env file is correct and has not expired. ` +
            `Key format should start with "dg_". ` +
            `Current key info: ${keyInfo}. ` +
            `Get a new key from https://console.deepgram.com/ ` +
            `(Type: ${error.type || 'Unknown'}, Code: ${errorCode}, Request ID: ${(error as any).request_id || 'N/A'})`;
          throw new Error(authErrorMsg);
        }
        
        throw new Error(`Deepgram API error: ${errorMessage} (Type: ${error.type || 'Unknown'}, Code: ${errorCode}, Request ID: ${(error as any).request_id || 'N/A'})`);
      }

      if (!result) {
        throw new Error('Empty result from Deepgram');
      }

      // Extract transcript text
      const transcriptText = result.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';

      if (!transcriptText) {
        throw new Error('No transcript text in response');
      }

      // Extract segments (utterances with speaker info)
      const segments: Array<{
        start: number;
        end: number;
        speaker?: number;
        text: string;
      }> = [];

      // Extract utterances (segments with speaker info)
      const utterances = result.results?.utterances || [];
      const words = result.results?.channels?.[0]?.alternatives?.[0]?.words || [];

      // Build segments from utterances if available, otherwise from words
      if (utterances && utterances.length > 0) {
        for (const utterance of utterances) {
          if (utterance.start !== undefined && utterance.end !== undefined) {
            const text = utterance.transcript || '';
            segments.push({
              start: utterance.start,
              end: utterance.end,
              speaker: utterance.speaker,
              text: text.trim(),
            });
          }
        }
      } else if (words && words.length > 0) {
        // Fallback: group words into segments by speaker
        let currentSegment: {
          start: number;
          end: number;
          speaker?: number;
          words: string[];
        } | null = null;

        for (const word of words) {
          if (word.start !== undefined && word.end !== undefined && word.word) {
            const speaker = word.speaker;
            if (!currentSegment || currentSegment.speaker !== speaker) {
              if (currentSegment) {
                segments.push({
                  start: currentSegment.start,
                  end: currentSegment.end,
                  speaker: currentSegment.speaker,
                  text: currentSegment.words.join(' '),
                });
              }
              currentSegment = {
                start: word.start,
                end: word.end,
                speaker,
                words: [word.word],
              };
            } else {
              currentSegment.words.push(word.word);
              currentSegment.end = word.end;
            }
          }
        }

        if (currentSegment) {
          segments.push({
            start: currentSegment.start,
            end: currentSegment.end,
            speaker: currentSegment.speaker,
            text: currentSegment.words.join(' '),
          });
        }
      }

      // Keyterms are not extracted from response - they are only used for Keyterm Prompting
      // Returning empty array for backward compatibility
      const keyterms: Array<{
        text: string;
        start: number;
        end: number;
        confidence: number;
      }> = [];

      // Get language and duration
      const metadata = result.metadata;
      // Always prefer explicitly requested language over detected language
      const detectedLanguage = metadata?.model_info?.language;
      const language = request.language || 'ru'; // Always use requested language or default to 'ru'
      
      console.log(`[Deepgram] Requested language: ${request.language || 'ru (default)'}`);
      console.log(`[Deepgram] Detected language from API: ${detectedLanguage || 'not provided'}`);
      console.log(`[Deepgram] Final language used: ${language}`);
      
      const duration = metadata?.duration || 0;

      return {
        data: {
          transcriptText,
          segments,
          keyterms,
          language,
          duration,
        },
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      console.error(`[Deepgram] Exception on attempt ${attempt + 1}:`, {
        message: lastError.message,
        stack: lastError.stack,
        name: lastError.name,
        fullError: error,
      });
      
      // If it's not the last attempt, wait before retrying
      if (attempt < DEEPGRAM_CONSTANTS.MAX_RETRIES - 1) {
        const delay = 1000 * (attempt + 1);
        console.log(`[Deepgram] Waiting ${delay}ms before retry...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  // Check if the error is an authentication error
  const isAuthError = lastError?.message?.toLowerCase().includes('authentication') ||
    lastError?.message?.toLowerCase().includes('invalid credentials') ||
    lastError?.message?.toLowerCase().includes('invalid_auth');
  
  const errorCode = isAuthError 
    ? DEEPGRAM_ERROR_CODES.INVALID_AUTH 
    : DEEPGRAM_ERROR_CODES.API_ERROR;
  
  const errorResponse = {
    error: {
      code: errorCode,
      message: DEEPGRAM_ERROR_MESSAGES[errorCode],
      details: {
        originalError: lastError?.message || 'Unknown error',
        errorName: lastError?.name || 'Unknown',
        errorStack: lastError?.stack || 'No stack trace',
        fileUrl: request.fileUrl ? request.fileUrl.substring(0, 100) : undefined, // First 100 chars for debugging
        hasFileBuffer: !!request.fileBuffer,
        fileBufferSize: request.fileBuffer ? request.fileBuffer.length : undefined,
        attempts: DEEPGRAM_CONSTANTS.MAX_RETRIES,
        isAuthError,
      },
    },
  };
  
  console.error('[Deepgram] All retry attempts exhausted. Final error:', errorResponse.error.details);
  
  return errorResponse;
}

