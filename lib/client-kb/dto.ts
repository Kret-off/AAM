/**
 * Client KB Module DTOs
 * Request and Response Data Transfer Objects
 */

import { PaginatedResponse } from './types';
import { MeetingResponse } from '../meeting/dto';

export interface CreateClientRequest {
  name: string;
}

export interface UpdateClientRequest {
  name?: string;
  contextSummary?: string;
}

export interface ClientResponse {
  id: string;
  name: string;
  contextSummary: string | null;
  createdAt: string;
  createdByUserId: string;
  updatedAt: string;
}

export interface ClientDetailResponse extends ClientResponse {
  meetingsCount?: number;
  createdByUserName?: string;
  meetings?: MeetingResponse[];
}

export interface ClientsListResponse extends PaginatedResponse<ClientResponse> {}

export interface ClientContextSummaryResponse {
  clientId: string;
  contextSummary: string | null;
  updatedAt: string;
}

export interface TransferClientOwnershipRequest {
  newOwnerUserId: string;
}





