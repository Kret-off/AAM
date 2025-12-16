'use client';

import { SectionCard } from '../components/section-card';
import { AlertTriangle, TrendingDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface RiskAssessmentData {
  deal_probability?: string;
  risks?: string[];
}

interface RiskAssessmentSectionProps {
  data: RiskAssessmentData | undefined;
}

const probabilityColors: Record<string, string> = {
  high: 'bg-green-100 text-green-800 border-green-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  low: 'bg-red-100 text-red-800 border-red-200',
};

export function RiskAssessmentSection({ data }: RiskAssessmentSectionProps) {
  if (!data) {
    return null;
  }

  const hasData = data.deal_probability || (data.risks && data.risks.length > 0);

  if (!hasData) {
    return null;
  }

  // Extract probability level from string (e.g., "high (вывод модели)" -> "high")
  const probabilityLevel = data.deal_probability
    ?.toLowerCase()
    .match(/\b(high|medium|low)\b/)?.[1] || '';

  return (
    <SectionCard title="Оценка рисков" icon={<AlertTriangle className="h-5 w-5" />}>
      <div className="space-y-4">
        {data.deal_probability && (
          <div className="flex items-start gap-2">
            <TrendingDown className="h-4 w-4 text-gray-500 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-medium text-gray-500 mb-2">Вероятность сделки:</p>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={`border ${probabilityColors[probabilityLevel] || 'bg-gray-100 text-gray-800 border-gray-200'}`}
                >
                  {data.deal_probability}
                </Badge>
              </div>
            </div>
          </div>
        )}

        {data.risks && data.risks.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-3">Риски:</p>
            <ul className="space-y-2">
              {data.risks.map((risk, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                  <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <span>{risk}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </SectionCard>
  );
}




