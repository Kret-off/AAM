/**
 * Artifacts Module Types
 * TypeScript types for artifacts structure and configuration
 */

// ArtifactsConfig types
export interface ArtifactsConfigSection {
  key: string;
  label: string;
  order: number;
  visible: boolean;
}

export interface ArtifactsConfig {
  sections: ArtifactsConfigSection[];
}

// Evidence types
export type SpeakerType = 'client' | 'our_team' | 'unknown';

export interface Evidence {
  quote: string;
  speaker: SpeakerType;
}

// Meta section types
export interface ParticipantObject {
  name?: string;
  role?: string;
  company?: string;
  department?: string;
}

export interface MetaParticipants {
  client?: Array<string | ParticipantObject>;
  our_team?: Array<string | ParticipantObject>;
}

export interface MetaData {
  brand?: string | null;
  meeting_date?: string | null;
  deal_stage?: string | null;
  source?: string | null;
  participants?: MetaParticipants;
}

// Client Profile types
export interface TeamSizeOrUsers {
  value?: number | string | null;
  unit?: string | null;
  evidence?: Record<string, unknown> | null;
}

export interface ClientProfile {
  company_name?: string | null;
  industry?: string | null;
  business_model?: string | null;
  geo?: string | null;
  current_tools?: string[];
  team_size_or_users?: TeamSizeOrUsers;
}

// Decision and Stakeholders types
export interface DecisionAndStakeholders {
  decision_maker?: string | null;
  users?: string[];
  roles_notes?: string[];
  evidence?: Array<Record<string, unknown>>;
}

// Pains types
export type PainPriority = 'high' | 'medium' | 'low' | null;

export interface Pain {
  pain: string;
  impact?: string | null;
  priority?: PainPriority;
  evidence: Evidence;
}

// Tasks and Requirements types
export type TaskCategory =
  | 'sales'
  | 'service'
  | 'production'
  | 'support'
  | 'management'
  | 'analytics'
  | 'integration'
  | 'other';

export interface TaskAndRequirement {
  task: string;
  category: TaskCategory;
  must_have?: boolean | null;
  details?: string | null;
  evidence: Evidence;
}

// Process Map types
export interface ProcessMap {
  as_is_steps?: string[];
  bottlenecks?: string[];
  evidence?: Array<Record<string, unknown>>;
}

// Channels and Integrations types
export type ChannelType = 'site' | 'avito' | 'whatsapp' | 'telegram' | 'email' | 'phone' | 'other';
export type IntegrationDirection = 'inbound' | 'outbound' | 'both' | null;

export interface Channel {
  channel: ChannelType;
  details?: string | null;
  raw_value?: string | null;
  evidence: Evidence;
}

export interface Integration {
  system: string;
  direction?: IntegrationDirection;
  details?: string | null;
  raw_value?: string | null;
  evidence: Evidence;
}

export interface ChannelsAndIntegrations {
  channels?: Channel[];
  integrations?: Integration[];
}

// Numbers and Terms types
export interface NumberValue {
  value?: number | string | null;
  currency?: string | null;
  unit?: string | null;
  evidence?: Record<string, unknown> | null;
}

export interface NumbersAndTerms {
  budget?: NumberValue;
  timeline?: NumberValue;
  users_count?: NumberValue;
  notes?: string[];
}

// Bitrix24 Scope types
export type WorkBlockType =
  | 'discovery'
  | 'setup'
  | 'crm_pipeline'
  | 'automation'
  | 'communications'
  | 'telephony'
  | 'forms'
  | 'open_lines'
  | 'tasks_projects'
  | 'reports'
  | 'integrations'
  | 'migration'
  | 'training'
  | 'support'
  | 'other';

export interface Bitrix24License {
  needs?: string | null;
  preferred?: string | null;
  evidence?: Record<string, unknown> | null;
}

export interface WorkBlock {
  block: WorkBlockType;
  items?: string[];
  evidence?: Array<Record<string, unknown>>;
}

export interface Bitrix24ScopeDraft {
  license?: Bitrix24License;
  work_blocks?: WorkBlock[];
}

// Proposal Materials types
export interface ProposalReadyMaterials {
  internal_summary_bullets?: string[];
  proposal_focus?: string[];
  client_value_emphasis?: string[];
  external_recap_2_3_sentences?: string;
}

// Gaps types
export type GapSeverity = 'critical' | 'important' | 'nice_to_have';
export type LinkedSection =
  | 'client_profile'
  | 'decision_and_stakeholders'
  | 'pains'
  | 'tasks_and_requirements'
  | 'process_map'
  | 'channels_and_integrations'
  | 'numbers_and_terms'
  | 'bitrix24_scope_draft'
  | 'other';

export interface MissingDataItem {
  item: string;
  why_needed_for_proposal: string;
  severity: GapSeverity;
  linked_section: LinkedSection;
}

export interface GapsForRegeneration {
  missing_data_items?: MissingDataItem[];
  cannot_determine_from_transcript?: string[];
}

// Quality Checks types
export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface AmbiguousPhrase {
  raw_fragment: string;
  why_ambiguous: string;
}

export interface QualityChecks {
  ambiguous_phrases?: AmbiguousPhrase[];
  confidence?: ConfidenceLevel;
}

// Quality types
export interface QualityData {
  missing_data_items: string[];
  notes: string[];
}

// Main Artifacts structure
export interface ArtifactsData {
  meta?: MetaData;
  client_profile?: ClientProfile;
  decision_and_stakeholders?: DecisionAndStakeholders;
  pains?: Pain[];
  tasks_and_requirements?: TaskAndRequirement[];
  process_map?: ProcessMap;
  channels_and_integrations?: ChannelsAndIntegrations;
  numbers_and_terms?: NumbersAndTerms;
  bitrix24_scope_draft?: Bitrix24ScopeDraft;
  proposal_ready_materials?: ProposalReadyMaterials;
  gaps_for_regeneration?: GapsForRegeneration;
  quality_checks?: QualityChecks;
}

/**
 * ArtifactsPayload structure is defined by outputSchema
 * No hardcoded wrapper - structure matches outputSchema exactly
 */
export type ArtifactsPayload = Record<string, unknown>;

