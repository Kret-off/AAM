'use client';

import { SectionCard } from '../components/section-card';
import { Presentation, DollarSign, Calendar, Gift } from 'lucide-react';
import { EvidenceBlock } from '../components/evidence-block';

interface KPStage {
  name: string;
  description?: string;
  mentioned_cost?: string;
  mentioned_timeline?: string;
  evidence: {
    quote: string;
    speaker: 'client' | 'our_team' | 'unknown';
  };
}

interface KPPresentationData {
  project_overview?: string;
  stages?: KPStage[];
  total_project_cost?: string;
  payment_terms?: string;
  timelines?: {
    discovery_phase?: string;
    implementation_phase?: string;
    other_timing?: string;
  };
  bonuses_and_special_terms?: string[];
}

interface KPPresentationSectionProps {
  data: KPPresentationData | undefined;
}

export function KPPresentationSection({ data }: KPPresentationSectionProps) {
  if (!data) {
    return null;
  }

  return (
    <SectionCard title="Презентация КП" icon={<Presentation className="h-5 w-5" />}>
      <div className="space-y-6">
        {data.project_overview && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Обзор проекта:</p>
            <p className="text-sm text-gray-700">{data.project_overview}</p>
          </div>
        )}

        {data.stages && data.stages.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-3">Этапы проекта:</p>
            <div className="space-y-4">
              {data.stages.map((stage, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-semibold text-gray-900">{stage.name}</h4>
                  </div>

                  {stage.description && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">Описание:</p>
                      <p className="text-sm text-gray-600">{stage.description}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {stage.mentioned_cost && (
                      <div className="flex items-start gap-2">
                        <DollarSign className="h-4 w-4 text-gray-500 mt-0.5" />
                        <div>
                          <p className="text-xs font-medium text-gray-500">Стоимость:</p>
                          <p className="text-sm text-gray-700">{stage.mentioned_cost}</p>
                        </div>
                      </div>
                    )}

                    {stage.mentioned_timeline && (
                      <div className="flex items-start gap-2">
                        <Calendar className="h-4 w-4 text-gray-500 mt-0.5" />
                        <div>
                          <p className="text-xs font-medium text-gray-500">Сроки:</p>
                          <p className="text-sm text-gray-700">{stage.mentioned_timeline}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {stage.evidence && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-2">Доказательство:</p>
                      <EvidenceBlock evidence={stage.evidence} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {data.total_project_cost && (
          <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <DollarSign className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-blue-700 mb-1">Общая стоимость проекта:</p>
              <p className="text-sm font-semibold text-blue-900">{data.total_project_cost}</p>
            </div>
          </div>
        )}

        {data.payment_terms && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Условия оплаты:</p>
            <p className="text-sm text-gray-700">{data.payment_terms}</p>
          </div>
        )}

        {data.timelines && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-3">Сроки:</p>
            <div className="space-y-2">
              {data.timelines.discovery_phase && (
                <div className="flex items-start gap-2">
                  <Calendar className="h-4 w-4 text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-gray-500">Фаза анализа:</p>
                    <p className="text-sm text-gray-700">{data.timelines.discovery_phase}</p>
                  </div>
                </div>
              )}
              {data.timelines.implementation_phase && (
                <div className="flex items-start gap-2">
                  <Calendar className="h-4 w-4 text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-gray-500">Фаза внедрения:</p>
                    <p className="text-sm text-gray-700">{data.timelines.implementation_phase}</p>
                  </div>
                </div>
              )}
              {data.timelines.other_timing && (
                <div className="flex items-start gap-2">
                  <Calendar className="h-4 w-4 text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-gray-500">Другие сроки:</p>
                    <p className="text-sm text-gray-700">{data.timelines.other_timing}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {data.bonuses_and_special_terms && data.bonuses_and_special_terms.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-3 flex items-center gap-2">
              <Gift className="h-4 w-4" />
              Бонусы и специальные условия:
            </p>
            <ul className="space-y-2">
              {data.bonuses_and_special_terms.map((term, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-blue-600 mt-1">•</span>
                  <span>{term}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </SectionCard>
  );
}




