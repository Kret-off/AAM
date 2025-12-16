/**
 * Orchestrator Error Handler
 * Centralized error handling and saving for orchestrator
 */

import { prisma } from '../prisma';
import { createModuleLogger } from '../logger';

const logger = createModuleLogger('Orchestrator:ErrorHandler');

/**
 * Save processing error to database
 * 
 * @param meetingId - Meeting ID
 * @param stage - Processing stage (transcription, llm, system)
 * @param errorCode - Error code
 * @param errorMessage - Error message
 * @param errorDetails - Optional error details
 */
export async function saveProcessingError(
  meetingId: string,
  stage: 'transcription' | 'llm' | 'system',
  errorCode: string,
  errorMessage: string,
  errorDetails?: Record<string, unknown>
): Promise<void> {
  try {
    const { generateShortId } = await import('../db/id-generator');
    const errorId = await generateShortId('processing_error');
    
    await prisma.processingError.create({
      data: {
        id: errorId,
        meetingId,
        stage,
        errorCode,
        errorMessage,
        errorDetails: errorDetails ? (errorDetails as object) : undefined,
      },
    });
    
    logger.debug(`Processing error saved`, {
      meetingId,
      stage,
      errorCode,
    });
  } catch (error) {
    // Log but don't throw - error saving should not block status update
    logger.error(`Failed to save processing error`, error, {
      meetingId,
      stage,
      errorCode,
    });
  }
}

