/**
 * Scenario Module Types
 * TypeScript type definitions
 */

import { PaginatedResponse } from '../meeting/types';

export interface ScenarioServiceError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ScenariosQueryParams {
  page?: number;
  pageSize?: number;
  filter?: {
    meetingTypeId?: string;
    isActive?: boolean;
    search?: string;
  };
}

export interface MeetingTypesQueryParams {
  isActive?: boolean;
}

export type ScenariosListResponse = PaginatedResponse<ScenarioResponse>;
export type MeetingTypesListResponse = MeetingTypeResponse[];








