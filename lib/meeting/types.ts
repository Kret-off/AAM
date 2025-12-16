/**
 * Meeting Module Types
 * Type definitions for meetings and related operations
 */

import { MeetingStatus, ValidationDecision } from '@prisma/client';

export interface MeetingData {
  id: string;
  clientId: string;
  ownerUserId: string;
  meetingTypeId: string;
  scenarioId: string;
  title: string | null;
  status: MeetingStatus;
  createdAt: Date;
  validatedAt: Date | null;
}

export interface MeetingFilter {
  status?: MeetingStatus;
  clientId?: string;
  ownerUserId?: string;
  meetingTypeId?: string;
  search?: string;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface MeetingsQueryParams extends PaginationParams {
  filter?: MeetingFilter;
}

export interface ParticipantSnapshot {
  participantId: string;
  snapshotFullName: string;
  snapshotRoleTitle?: string;
  snapshotCompanyName?: string;
  snapshotDepartment?: string;
}








