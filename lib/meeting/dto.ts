/**
 * Meeting Module DTOs
 * Request and Response Data Transfer Objects
 */

import { MeetingStatus, ValidationDecision } from '@prisma/client';
import { PaginatedResponse } from './types';

export interface CreateMeetingRequest {
  clientId: string;
  meetingTypeId: string;
  scenarioId: string;
  title?: string;
  participantIds: string[];
}

export interface UpdateMeetingRequest {
  title?: string;
}

export interface ValidateMeetingRequest {
  decision: ValidationDecision;
  rejectionReason?: string;
}

export interface AddViewerRequest {
  userId: string;
}

export interface TransferOwnershipRequest {
  newOwnerUserId: string;
}

export interface MeetingResponse {
  id: string;
  clientId: string;
  clientName: string;
  ownerUserId: string;
  ownerName: string;
  meetingTypeId: string;
  meetingTypeName: string;
  scenarioId: string;
  scenarioName: string;
  title: string | null;
  status: MeetingStatus;
  createdAt: string;
  validatedAt: string | null;
}

export interface MeetingDetailResponse extends MeetingResponse {
  participants: MeetingParticipantResponse[];
  viewers: MeetingViewerResponse[];
  hasTranscript: boolean;
  hasArtifacts: boolean;
  hasValidation: boolean;
  validationDecision?: ValidationDecision;
  latestError?: {
    stage: string;
    code: string;
    message: string;
    details?: Record<string, unknown>;
    occurredAt: string;
  };
  errorHistory?: Array<{
    id: string;
    stage: string;
    code: string;
    message: string;
    details?: Record<string, unknown>;
    occurredAt: string;
  }>;
  autoRetryCount?: number;
  lastAutoRetryAt?: string | null;
  nextAutoRetryAt?: string | null;
}

export interface MeetingParticipantResponse {
  participantId: string;
  snapshotFullName: string;
  snapshotRoleTitle: string | null;
  snapshotCompanyName: string | null;
  snapshotDepartment: string | null;
  addedAt: string;
}

export interface MeetingViewerResponse {
  userId: string;
  userName: string;
  addedAt: string;
  addedByUserId: string;
  addedByName: string;
}

export interface MeetingsListResponse extends PaginatedResponse<MeetingResponse> {}

