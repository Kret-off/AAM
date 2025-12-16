/**
 * Directory Module DTOs
 * Request and Response Data Transfer Objects
 */

import { ParticipantType } from './types';
import { PaginatedResponse } from './types';

export interface CreateParticipantRequest {
  type: ParticipantType;
  fullName: string;
  roleTitle?: string;
  companyName?: string;
  department?: string;
  tags?: Record<string, unknown> | unknown[];
}

export interface UpdateParticipantRequest {
  type?: ParticipantType;
  fullName?: string;
  roleTitle?: string;
  companyName?: string;
  department?: string;
  tags?: Record<string, unknown> | unknown[];
  isActive?: boolean;
}

export interface ParticipantResponse {
  id: string;
  type: ParticipantType;
  fullName: string;
  roleTitle: string | null;
  companyName: string | null;
  department: string | null;
  tags: Record<string, unknown> | null;
  isActive: boolean;
  createdAt: string;
  createdByUserId: string;
}

export interface ParticipantDetailResponse extends ParticipantResponse {
  createdByUserName?: string;
  meetingsCount?: number;
}

export interface ParticipantsListResponse extends PaginatedResponse<ParticipantResponse> {}








