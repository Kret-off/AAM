/**
 * Directory Module Types
 * Type definitions for participant directory
 */

export type ParticipantType = 'internal' | 'external';

export interface ParticipantData {
  id: string;
  type: ParticipantType;
  fullName: string;
  roleTitle: string | null;
  companyName: string | null;
  department: string | null;
  tags: Record<string, unknown> | null;
  isActive: boolean;
  createdAt: Date;
  createdByUserId: string;
}

export interface ParticipantFilter {
  type?: ParticipantType;
  isActive?: boolean;
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

export interface ParticipantsQueryParams extends PaginationParams {
  filter?: ParticipantFilter;
}








