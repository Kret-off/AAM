'use client';

import { SectionCard } from '../components/section-card';
import { Lightbulb, X } from 'lucide-react';
import { EvidenceBlock } from '../components/evidence-block';
import { Badge } from '@/components/ui/badge';

interface AdditionalNeed {
  need: string;
  category?: string;
  must_have?: boolean | null;
  details?: string | null;
  evidence: {
    quote: string;
    speaker: 'client' | 'our_team' | 'unknown';
  };
}

interface AdditionalNeedsSectionProps {
  data: AdditionalNeed[] | undefined;
}

const categoryLabels: Record<string, string> = {
  sales: 'Продажи',
  service: 'Сервис',
  production: 'Производство',
  support: 'Поддержка',
  management: 'Управление',
  analytics: 'Аналитика',
  integration: 'Интеграции',
  other: 'Другое',
};

export function AdditionalNeedsSection({ data }: AdditionalNeedsSectionProps) {
  if (!data || data.length === 0) {
    return null;
  }

  return (
    <SectionCard title="Дополнительные потребности" icon={<Lightbulb className="h-5 w-5" />}>
      <div className="space-y-4">
        {data.map((item, idx) => (
          <div key={idx} className="border border-gray-200 rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-sm font-semibold text-gray-900 flex-1">{item.need}</h4>
              <div className="flex items-center gap-2">
                {item.category && (
                  <Badge variant="outline" className="text-xs">
                    {categoryLabels[item.category] || item.category}
                  </Badge>
                )}
                {item.must_have !== null && item.must_have !== undefined && (
                  <div className="flex items-center gap-1">
                    {item.must_have ? (
                      <Lightbulb className="h-4 w-4 text-green-600" />
                    ) : (
                      <X className="h-4 w-4 text-gray-400" />
                    )}
                    <span className="text-xs text-gray-600">
                      {item.must_have ? 'Обязательно' : 'Не обязательно'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {item.details && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Детали:</p>
                <p className="text-sm text-gray-600">{item.details}</p>
              </div>
            )}

            {item.evidence && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Доказательство:</p>
                <EvidenceBlock evidence={item.evidence} />
              </div>
            )}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}




