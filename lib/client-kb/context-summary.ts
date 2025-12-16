/**
 * Client KB Module - Context Summary Service
 * Business logic for updating Client Context Summary
 */

import { ContextSummaryInput } from './types';
import { CLIENT_KB_ERROR_CODES, CLIENT_KB_ERROR_MESSAGES } from './constants';
import { validateClientId } from './validation';
import { prisma } from '../prisma';

export interface ContextSummaryError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Generate new context summary from previous summary and meeting metadata
 * Adds meeting_summary_for_context in the specified format if available
 */
async function generateContextSummary(
  previousSummary: string | null,
  meetingMetadata?: {
    scenarioName?: string;
    meetingNumber?: number;
    meetingSummaryForContext?: string;
  }
): Promise<string> {
  const lines: string[] = [];
  
  // Add meeting_summary_for_context if available
  if (meetingMetadata?.meetingSummaryForContext && meetingMetadata.meetingNumber) {
    const scenarioName = meetingMetadata.scenarioName || 'Не указан';
    const meetingEntry = `Встреча №${meetingMetadata.meetingNumber} Сценарий встречи: ${scenarioName} Контекст: ${meetingMetadata.meetingSummaryForContext}`;
    lines.push(meetingEntry);
    lines.push(''); // Empty line after entry
  }
  
  const newContent = lines.join('\n');
  
  // If there's previous summary, append new content (don't overwrite)
  if (previousSummary) {
    return `${previousSummary}\n\n${newContent}`;
  }

  return newContent;
}

/**
 * Update Client Context Summary after meeting validation Accept
 * This function should be called from a job after meeting is accepted
 */
export async function updateContextSummary(
  clientId: string,
  input: ContextSummaryInput
): Promise<{ success: true; summary: string } | { error: ContextSummaryError }> {
  // Validate client ID
  const idValidation = validateClientId(clientId);
  if (!idValidation.valid) {
    return {
      error: {
        code: idValidation.error!.code,
        message: idValidation.error!.message,
      },
    };
  }

  try {
    // Verify client exists
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        clientContextSummaryMd: true,
      },
    });

    if (!client) {
      return {
        error: {
          code: CLIENT_KB_ERROR_CODES.CLIENT_NOT_FOUND,
          message: CLIENT_KB_ERROR_MESSAGES[CLIENT_KB_ERROR_CODES.CLIENT_NOT_FOUND],
        },
      };
    }

    // Generate new summary
    const newSummary = await generateContextSummary(
      client.clientContextSummaryMd,
      input.meetingMetadata
    );

    // Update client with new summary in a transaction
    await prisma.$transaction(async (tx) => {
      await tx.client.update({
        where: { id: clientId },
        data: {
          clientContextSummaryMd: newSummary,
        },
      });
    });

    return {
      success: true,
      summary: newSummary,
    };
  } catch (error) {
    return {
      error: {
        code: CLIENT_KB_ERROR_CODES.CONTEXT_SUMMARY_UPDATE_FAILED,
        message: CLIENT_KB_ERROR_MESSAGES[CLIENT_KB_ERROR_CODES.CONTEXT_SUMMARY_UPDATE_FAILED],
        details: {
          originalError: error instanceof Error ? error.message : 'Unknown error',
          clientId,
        },
      },
    };
  }
}

/**
 * Get current context summary for a client
 */
export async function getContextSummary(
  clientId: string
): Promise<{ summary: string | null } | { error: ContextSummaryError }> {
  // Validate client ID
  const idValidation = validateClientId(clientId);
  if (!idValidation.valid) {
    return {
      error: {
        code: idValidation.error!.code,
        message: idValidation.error!.message,
      },
    };
  }

  try {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        clientContextSummaryMd: true,
      },
    });

    if (!client) {
      return {
        error: {
          code: CLIENT_KB_ERROR_CODES.CLIENT_NOT_FOUND,
          message: CLIENT_KB_ERROR_MESSAGES[CLIENT_KB_ERROR_CODES.CLIENT_NOT_FOUND],
        },
      };
    }

    return {
      summary: client.clientContextSummaryMd,
    };
  } catch (error) {
    return {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch context summary',
        details: {
          originalError: error instanceof Error ? error.message : 'Unknown error',
        },
      },
    };
  }
}

