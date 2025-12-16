/**
 * Scenario Module DTOs
 * Request and Response Data Transfer Objects
 */

export interface CreateScenarioRequest {
  meetingTypeId: string;
  name: string;
  systemPrompt: string;
  outputSchema: unknown; // JSON schema
  artifactsConfig: unknown; // JSON config
  keyterms?: string[]; // Keyterms for Deepgram Keyterm Prompting to improve transcription
  isActive?: boolean;
}

export interface UpdateScenarioRequest {
  meetingTypeId?: string;
  name?: string;
  systemPrompt?: string;
  outputSchema?: unknown; // JSON schema
  artifactsConfig?: unknown; // JSON config
  keyterms?: string[]; // Keyterms for Deepgram Keyterm Prompting to improve transcription
  isActive?: boolean;
}

export interface ScenarioResponse {
  id: string;
  meetingTypeId: string;
  meetingTypeName: string;
  name: string;
  systemPrompt: string;
  outputSchema: unknown;
  artifactsConfig: unknown;
  keyterms: string[]; // Keyterms for Deepgram Keyterm Prompting to improve transcription
  isActive: boolean;
  version: number;
  updatedAt: string;
  updatedByUserId: string;
  updatedByUserName?: string;
}

export interface ScenarioDetailResponse extends ScenarioResponse {
  meetingsCount?: number;
}

export interface CreateMeetingTypeRequest {
  name: string;
  isActive?: boolean;
  userIds?: string[]; // Users who have access to this meeting type
}

export interface UpdateMeetingTypeRequest {
  name?: string;
  isActive?: boolean;
  userIds?: string[]; // Users who have access to this meeting type
}

export interface MeetingTypeUser {
  id: string;
  email: string;
  name: string;
}

export interface MeetingTypeResponse {
  id: string;
  name: string;
  isActive: boolean;
  scenariosCount?: number;
  users?: MeetingTypeUser[]; // Users who have access to this meeting type
}


