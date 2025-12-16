/**
 * Meeting Module Constants
 * Error codes, error messages, and status transition rules
 */

import { MeetingStatus, ValidationDecision } from '@prisma/client';

export const MEETING_ERROR_CODES = {
  MEETING_NOT_FOUND: 'MEETING_NOT_FOUND',
  INVALID_MEETING_ID: 'INVALID_MEETING_ID',
  UNAUTHORIZED_ACCESS: 'UNAUTHORIZED_ACCESS',
  ONLY_OWNER_CAN_VALIDATE: 'ONLY_OWNER_CAN_VALIDATE',
  ONLY_OWNER_CAN_SHARE: 'ONLY_OWNER_CAN_SHARE',
  ONLY_OWNER_CAN_TRANSFER: 'ONLY_OWNER_CAN_TRANSFER',
  INVALID_STATUS_TRANSITION: 'INVALID_STATUS_TRANSITION',
  MEETING_NOT_READY: 'MEETING_NOT_READY',
  CLIENT_NOT_FOUND: 'CLIENT_NOT_FOUND',
  MEETING_TYPE_NOT_FOUND: 'MEETING_TYPE_NOT_FOUND',
  SCENARIO_NOT_FOUND: 'SCENARIO_NOT_FOUND',
  PARTICIPANT_NOT_FOUND: 'PARTICIPANT_NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  VIEWER_ALREADY_EXISTS: 'VIEWER_ALREADY_EXISTS',
  VIEWER_NOT_FOUND: 'VIEWER_NOT_FOUND',
  CANNOT_TRANSFER_TO_SELF: 'CANNOT_TRANSFER_TO_SELF',
  INVALID_VALIDATION_DECISION: 'INVALID_VALIDATION_DECISION',
  SCENARIO_NOT_MATCHING_MEETING_TYPE: 'SCENARIO_NOT_MATCHING_MEETING_TYPE',
} as const;

export const MEETING_ERROR_MESSAGES = {
  [MEETING_ERROR_CODES.MEETING_NOT_FOUND]: 'Meeting not found',
  [MEETING_ERROR_CODES.INVALID_MEETING_ID]: 'Invalid meeting ID format',
  [MEETING_ERROR_CODES.UNAUTHORIZED_ACCESS]: 'Unauthorized access to meeting',
  [MEETING_ERROR_CODES.ONLY_OWNER_CAN_VALIDATE]: 'Only meeting owner can validate',
  [MEETING_ERROR_CODES.ONLY_OWNER_CAN_SHARE]: 'Only meeting owner can share',
  [MEETING_ERROR_CODES.ONLY_OWNER_CAN_TRANSFER]: 'Only meeting owner can transfer ownership',
  [MEETING_ERROR_CODES.INVALID_STATUS_TRANSITION]: 'Invalid status transition',
  [MEETING_ERROR_CODES.MEETING_NOT_READY]: 'Meeting is not ready for validation',
  [MEETING_ERROR_CODES.CLIENT_NOT_FOUND]: 'Client not found',
  [MEETING_ERROR_CODES.MEETING_TYPE_NOT_FOUND]: 'Meeting type not found',
  [MEETING_ERROR_CODES.SCENARIO_NOT_FOUND]: 'Scenario not found',
  [MEETING_ERROR_CODES.PARTICIPANT_NOT_FOUND]: 'Participant not found',
  [MEETING_ERROR_CODES.USER_NOT_FOUND]: 'User not found',
  [MEETING_ERROR_CODES.VIEWER_ALREADY_EXISTS]: 'User is already a viewer',
  [MEETING_ERROR_CODES.VIEWER_NOT_FOUND]: 'Viewer not found',
  [MEETING_ERROR_CODES.CANNOT_TRANSFER_TO_SELF]: 'Cannot transfer ownership to yourself',
  [MEETING_ERROR_CODES.INVALID_VALIDATION_DECISION]: 'Invalid validation decision. Must be "accepted" or "rejected"',
  [MEETING_ERROR_CODES.SCENARIO_NOT_MATCHING_MEETING_TYPE]: 'Selected scenario does not match the selected meeting type',
} as const;

export const MEETING_CONSTANTS = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  MAX_TITLE_LENGTH: 255,
} as const;

/**
 * Valid status transitions
 */
export const VALID_STATUS_TRANSITIONS: Record<MeetingStatus, MeetingStatus[]> = {
  Uploaded: ['Transcribing', 'Failed_System'],
  Transcribing: ['LLM_Processing', 'Failed_Transcription', 'Failed_System'],
  LLM_Processing: ['Ready', 'Failed_LLM', 'Failed_System'],
  Ready: ['Validated', 'Rejected'],
  Validated: [], // Terminal state
  Rejected: [], // Terminal state
  Failed_Transcription: ['Uploaded'], // Allow retry
  Failed_LLM: ['LLM_Processing', 'Uploaded'], // LLM_Processing if transcript exists, Uploaded otherwise
  Failed_System: ['Uploaded'], // Allow retry
};

/**
 * Statuses that allow validation
 */
export const VALIDATION_ALLOWED_STATUSES: MeetingStatus[] = ['Ready'];

export type MeetingErrorCode = (typeof MEETING_ERROR_CODES)[keyof typeof MEETING_ERROR_CODES];

