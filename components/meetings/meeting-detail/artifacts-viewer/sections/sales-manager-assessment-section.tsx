'use client';

import { SectionCard } from '../components/section-card';
import { Star, TrendingUp, TrendingDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface SalesManagerAssessmentData {
  score_0_10?: number | null;
  strengths?: string[];
  improvements?: string[];
}

interface SalesManagerAssessmentSectionProps {
  data: SalesManagerAssessmentData | undefined;
}

const getScoreColor = (score: number): string => {
  if (score >= 8) return 'bg-green-100 text-green-800 border-green-200';
  if (score >= 6) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  return 'bg-red-100 text-red-800 border-red-200';
};

export function SalesManagerAssessmentSection({ data }: SalesManagerAssessmentSectionProps) {
  if (!data) {
    return null;
  }

  const hasData =
    data.score_0_10 !== null && data.score_0_10 !== undefined ||
    (data.strengths && data.strengths.length > 0) ||
    (data.improvements && data.improvements.length > 0);

  if (!hasData) {
    return null;
  }

  return (
    <SectionCard title="Оценка менеджера" icon={<Star className="h-5 w-5" />}>
      <div className="space-y-5">
        {data.score_0_10 !== null && data.score_0_10 !== undefined && (
          <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <Star className="h-5 w-5 text-blue-600" />
            <div className="flex-1">
              <p className="text-xs font-medium text-blue-700 mb-1">Оценка (0-10):</p>
              <Badge
                variant="outline"
                className={`border text-lg font-semibold ${getScoreColor(data.score_0_10)}`}
              >
                {data.score_0_10}/10
              </Badge>
            </div>
          </div>
        )}

        {data.strengths && data.strengths.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <p className="text-sm font-semibold text-gray-900">Сильные стороны:</p>
            </div>
            <ul className="space-y-2">
              {data.strengths.map((strength, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-green-600 mt-1">✓</span>
                  <span>{strength}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {data.improvements && data.improvements.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingDown className="h-4 w-4 text-yellow-600" />
              <p className="text-sm font-semibold text-gray-900">Что улучшить:</p>
            </div>
            <ul className="space-y-2">
              {data.improvements.map((improvement, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-yellow-600 mt-1">→</span>
                  <span>{improvement}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </SectionCard>
  );
}




