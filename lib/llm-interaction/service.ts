/**
 * LLM Interaction Module Service
 * Business logic for saving and retrieving LLM interactions
 */

import { prisma } from '../prisma';
import { SaveLLMInteractionData, LLMInteractionWithDetails } from './types';
import { generateShortId } from '../db/id-generator';

/**
 * Save LLM interaction to database
 */
export async function saveLLMInteraction(
  data: SaveLLMInteractionData
): Promise<LLMInteractionWithDetails> {
  const interactionId = await generateShortId('llm_interaction');
  return await prisma.lLMInteraction.create({
    data: {
      id: interactionId,
      meetingId: data.meetingId,
      attemptNumber: data.attemptNumber,
      isRepairAttempt: data.isRepairAttempt,
      systemPrompt: data.systemPrompt,
      userPrompt: data.userPrompt,
      model: data.model || 'gpt-5.1',
      temperature: data.temperature ?? 0.3,
      maxTokens: data.maxTokens ?? 8000,
      rawResponse: data.rawResponse || null,
      extractedJson: data.extractedJson ? (data.extractedJson as object) : undefined,
      requestMetadata: data.requestMetadata ? (data.requestMetadata as object) : undefined,
      isValid: data.isValid ?? null,
      validationErrors: data.validationErrors ? (data.validationErrors as object) : undefined,
      isFinal: data.isFinal ?? false,
      apiResponseMetadata: data.apiResponseMetadata ? (data.apiResponseMetadata as object) : undefined,
      errorCode: data.errorCode || null,
      errorMessage: data.errorMessage || null,
      errorDetails: data.errorDetails ? (data.errorDetails as object) : undefined,
      requestedAt: data.requestedAt || new Date(),
      respondedAt: data.respondedAt || null,
      processedAt: data.processedAt || null,
    },
  });
}

/**
 * Get all LLM interactions for a meeting
 */
export async function getLLMInteractions(
  meetingId: string
): Promise<LLMInteractionWithDetails[]> {
  return await prisma.lLMInteraction.findMany({
    where: { meetingId },
    orderBy: [
      { attemptNumber: 'asc' },
      { isRepairAttempt: 'asc' },
      { requestedAt: 'asc' },
    ],
  });
}

/**
 * Get final successful LLM interaction for a meeting
 */
export async function getFinalLLMInteraction(
  meetingId: string
): Promise<LLMInteractionWithDetails | null> {
  return await prisma.lLMInteraction.findFirst({
    where: {
      meetingId,
      isFinal: true,
    },
    orderBy: {
      requestedAt: 'desc',
    },
  });
}

