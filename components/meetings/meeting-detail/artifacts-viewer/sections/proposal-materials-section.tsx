'use client';

import { ProposalReadyMaterials } from '@/lib/artifacts/types';
import { SectionCard } from '../components/section-card';
import { FileText } from 'lucide-react';

interface ProposalMaterialsSectionProps {
  data: ProposalReadyMaterials | undefined;
}

export function ProposalMaterialsSection({ data }: ProposalMaterialsSectionProps) {
  if (!data) {
    return null;
  }

  const hasData =
    data.internal_summary_bullets?.length ||
    data.proposal_focus?.length ||
    data.client_value_emphasis?.length ||
    data.external_recap_2_3_sentences;

  if (!hasData) {
    return null;
  }

  return (
    <SectionCard title="Материалы для предложения" icon={<FileText className="h-5 w-5" />}>
      <div className="space-y-4">
        {data.internal_summary_bullets && data.internal_summary_bullets.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Внутренние summary bullets</p>
            <ul className="text-sm text-gray-600 space-y-1">
              {data.internal_summary_bullets.map((bullet, idx) => (
                <li key={idx}>• {bullet}</li>
              ))}
            </ul>
          </div>
        )}

        {data.proposal_focus && data.proposal_focus.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Фокус предложения</p>
            <ul className="text-sm text-gray-600 space-y-1">
              {data.proposal_focus.map((focus, idx) => (
                <li key={idx}>• {focus}</li>
              ))}
            </ul>
          </div>
        )}

        {data.client_value_emphasis && data.client_value_emphasis.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Акцент на ценности для клиента</p>
            <ul className="text-sm text-gray-600 space-y-1">
              {data.client_value_emphasis.map((value, idx) => (
                <li key={idx}>• {value}</li>
              ))}
            </ul>
          </div>
        )}

        {data.external_recap_2_3_sentences && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Внешний recap (2-3 предложения)</p>
            <p className="text-sm text-gray-600">{data.external_recap_2_3_sentences}</p>
          </div>
        )}
      </div>
    </SectionCard>
  );
}







