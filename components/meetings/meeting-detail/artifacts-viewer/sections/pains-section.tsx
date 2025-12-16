'use client';

import { Pain } from '@/lib/artifacts/types';
import { SectionCard } from '../components/section-card';
import { AlertCircle } from 'lucide-react';
import { EvidenceBlock } from '../components/evidence-block';
import { PriorityBadge } from '../components/priority-badge';

interface PainsSectionProps {
  data: Pain[] | undefined;
}

export function PainsSection({ data }: PainsSectionProps) {
  if (!data || data.length === 0) {
    return null;
  }

  return (
    <SectionCard title="Боли клиента" icon={<AlertCircle className="h-5 w-5" />}>
      <div className="space-y-4">
        {data.map((pain, idx) => (
          <div key={idx} className="border border-gray-200 rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-sm font-semibold text-gray-900 flex-1">{pain.pain}</h4>
              {pain.priority && <PriorityBadge priority={pain.priority} />}
            </div>

            {pain.impact && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Влияние:</p>
                <p className="text-sm text-gray-600">{pain.impact}</p>
              </div>
            )}

            {pain.evidence && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Доказательство:</p>
                <EvidenceBlock evidence={pain.evidence} />
              </div>
            )}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}







