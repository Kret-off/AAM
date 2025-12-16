/**
 * Client KB Module Types
 * Type definitions for client and context summary
 */

export interface ClientData {
  id: string;
  name: string;
  clientContextSummaryMd: string | null;
  createdAt: Date;
  createdByUserId: string;
  updatedAt: Date;
}

export interface ClientWithSummary extends ClientData {
  contextSummary: string | null;
}

export interface ContextSummaryInput {
  previousSummary: string | null;
  meetingMetadata: {
    meetingId: string;
    meetingType: string;
    title?: string;
    createdAt: Date;
    scenarioName?: string;
    meetingNumber?: number;
    meetingSummaryForContext?: string;
  };
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  search?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}


