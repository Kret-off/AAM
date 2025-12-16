'use client';

import { ArtifactsPayload, ArtifactsConfig } from '@/lib/artifacts/types';
import { getVisibleSections, parseArtifactsConfig } from '@/lib/artifacts/config-parser';
import { MetaSection } from './sections/meta-section';
import { ClientProfileSection } from './sections/client-profile-section';
import { DecisionStakeholdersSection } from './sections/decision-stakeholders-section';
import { PainsSection } from './sections/pains-section';
import { TasksRequirementsSection } from './sections/tasks-requirements-section';
import { ProcessMapSection } from './sections/process-map-section';
import { ChannelsIntegrationsSection } from './sections/channels-integrations-section';
import { NumbersTermsSection } from './sections/numbers-terms-section';
import { Bitrix24ScopeSection } from './sections/bitrix24-scope-section';
import { ProposalMaterialsSection } from './sections/proposal-materials-section';
import { GapsSection } from './sections/gaps-section';
import { QualitySection } from './sections/quality-section';
import { GenericSection } from './sections/generic-section';
import { AdditionalNeedsSection } from './sections/additional-needs-section';
import { KPPresentationSection } from './sections/kp-presentation-section';
import { ClientFeedbackKPSection } from './sections/client-feedback-kp-section';
import { ClientDecisionPositionSection } from './sections/client-decision-position-section';
import { NextStepsSection } from './sections/next-steps-section';
import { RiskAssessmentSection } from './sections/risk-assessment-section';
import { SalesManagerAssessmentSection } from './sections/sales-manager-assessment-section';
import { MeetingOverviewSection } from './sections/meeting-overview-section';
import { DiscussionTopicsDetailedSection } from './sections/discussion-topics-detailed-section';
import { ClientConclusionsSection } from './sections/client-conclusions-section';
import { OurConclusionsSection } from './sections/our-conclusions-section';
import { ObjectionsAndRisksSection } from './sections/objections-and-risks-section';

interface StructuredArtifactsViewProps {
  artifacts: ArtifactsPayload;
  artifactsConfig?: unknown;
}

/**
 * Normalize artifacts payload - support both old {artifacts: {...}, quality: {...}} and new structure
 */
function normalizeArtifacts(payload: ArtifactsPayload): {
  data: Record<string, unknown>;
  quality?: { missing_data_items?: string[]; notes?: string[] };
} {
  // Check if it's old structure with wrapper
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'artifacts' in payload &&
    typeof payload.artifacts === 'object'
  ) {
    // Old structure
    return {
      data: (payload.artifacts as Record<string, unknown>) || {},
      quality: 'quality' in payload ? (payload.quality as { missing_data_items?: string[]; notes?: string[] }) : undefined,
    };
  }
  // New structure - use payload directly
  return {
    data: (payload as Record<string, unknown>) || {},
  };
}

export function StructuredArtifactsView({
  artifacts,
  artifactsConfig,
}: StructuredArtifactsViewProps) {
  const config = parseArtifactsConfig(artifactsConfig);
  const visibleSections = getVisibleSections(config);
  const { data, quality } = normalizeArtifacts(artifacts);

  // Map section keys to components
  const sectionComponents: Record<string, React.ComponentType<{ data: unknown }>> = {
    meta: MetaSection,
    client_profile: ClientProfileSection,
    decision_and_stakeholders: DecisionStakeholdersSection,
    pains: PainsSection,
    tasks_and_requirements: TasksRequirementsSection,
    additional_needs: AdditionalNeedsSection,
    process_map: ProcessMapSection,
    channels_and_integrations: ChannelsIntegrationsSection,
    numbers_and_terms: NumbersTermsSection,
    bitrix24_scope_draft: Bitrix24ScopeSection,
    proposal_ready_materials: ProposalMaterialsSection,
    kp_presentation: KPPresentationSection,
    client_feedback_on_kp: ClientFeedbackKPSection,
    client_decision_and_position: ClientDecisionPositionSection,
    next_steps: NextStepsSection,
    risk_assessment: RiskAssessmentSection,
    sales_manager_assessment: SalesManagerAssessmentSection,
    gaps_for_regeneration: GapsSection,
    meeting_overview: MeetingOverviewSection,
    discussion_topics_detailed: DiscussionTopicsDetailedSection,
    client_conclusions: ClientConclusionsSection,
    our_conclusions: OurConclusionsSection,
    objections_and_risks: ObjectionsAndRisksSection,
  };

  // Special handling for quality section (combines quality and quality_checks)
  const qualitySection = visibleSections.find((s) => s.key === 'quality');
  const qualityChecksSection = visibleSections.find((s) => s.key === 'quality_checks');

  return (
    <div className="space-y-6">
      {visibleSections.map((section) => {
        // Skip quality_checks as it's handled with quality
        if (section.key === 'quality_checks') {
          return null;
        }

        // Special handling for quality section
        if (section.key === 'quality') {
          const showQuality =
            qualitySection?.visible || qualityChecksSection?.visible;
          if (showQuality && quality) {
            return (
              <QualitySection
                key={section.key}
                qualityData={quality}
                qualityChecks={data.quality_checks as { ambiguous_phrases?: Array<{ raw_fragment: string; why_ambiguous: string }>; confidence?: string } | undefined}
              />
            );
          }
          return null;
        }

        // Regular sections - try specific component first
        const SectionComponent = sectionComponents[section.key];
        const sectionData = data[section.key];

        if (SectionComponent && sectionData !== undefined) {
          return <SectionComponent key={section.key} data={sectionData} />;
        }

        // Fallback to generic renderer for unknown sections
        if (sectionData !== undefined) {
          return (
            <GenericSection
              key={section.key}
              title={section.label}
              data={sectionData}
            />
          );
        }

        return null;
      })}
    </div>
  );
}

