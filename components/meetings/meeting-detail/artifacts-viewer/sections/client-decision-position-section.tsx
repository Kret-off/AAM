'use client';

import { SectionCard } from '../components/section-card';
import { UserCheck, TrendingUp, DollarSign, Calendar, User } from 'lucide-react';
import { EvidenceBlock } from '../components/evidence-block';
import { Badge } from '@/components/ui/badge';

interface ClientDecisionPositionData {
  stance?: string;
  interest_level?: 'high' | 'medium' | 'low' | null;
  budget_attitude?: string;
  budget_range?: string;
  decision_maker?: string;
  next_feedback_date?: string;
  evidence?: {
    quote: string;
    speaker: 'client' | 'unknown';
  };
}

interface ClientDecisionPositionSectionProps {
  data: ClientDecisionPositionData | undefined;
}

const interestLevelLabels = {
  high: 'Высокий',
  medium: 'Средний',
  low: 'Низкий',
};

const interestLevelColors = {
  high: 'bg-green-100 text-green-800 border-green-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  low: 'bg-red-100 text-red-800 border-red-200',
};

export function ClientDecisionPositionSection({ data }: ClientDecisionPositionSectionProps) {
  if (!data) {
    return null;
  }

  return (
    <SectionCard title="Решение и позиция клиента" icon={<UserCheck className="h-5 w-5" />}>
      <div className="space-y-4">
        {data.stance && (
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-xs font-medium text-blue-700 mb-2">Позиция клиента:</p>
            <p className="text-sm text-blue-900">{data.stance}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.interest_level && (
            <div className="flex items-start gap-2">
              <TrendingUp className="h-4 w-4 text-gray-500 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-medium text-gray-500 mb-1">Уровень интереса:</p>
                <Badge
                  variant="outline"
                  className={`border ${interestLevelColors[data.interest_level] || 'bg-gray-100 text-gray-800 border-gray-200'}`}
                >
                  {interestLevelLabels[data.interest_level] || data.interest_level}
                </Badge>
              </div>
            </div>
          )}

          {data.budget_attitude && (
            <div className="flex items-start gap-2">
              <DollarSign className="h-4 w-4 text-gray-500 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-medium text-gray-500 mb-1">Отношение к бюджету:</p>
                <p className="text-sm text-gray-700">{data.budget_attitude}</p>
              </div>
            </div>
          )}

          {data.budget_range && (
            <div className="flex items-start gap-2">
              <DollarSign className="h-4 w-4 text-gray-500 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-medium text-gray-500 mb-1">Диапазон бюджета:</p>
                <p className="text-sm text-gray-700">{data.budget_range}</p>
              </div>
            </div>
          )}

          {data.decision_maker && (
            <div className="flex items-start gap-2">
              <User className="h-4 w-4 text-gray-500 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-medium text-gray-500 mb-1">ЛПР:</p>
                <p className="text-sm text-gray-700">{data.decision_maker}</p>
              </div>
            </div>
          )}

          {data.next_feedback_date && (
            <div className="flex items-start gap-2">
              <Calendar className="h-4 w-4 text-gray-500 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-medium text-gray-500 mb-1">Срок обратной связи:</p>
                <p className="text-sm text-gray-700">{data.next_feedback_date}</p>
              </div>
            </div>
          )}
        </div>

        {data.evidence && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Доказательство:</p>
            <EvidenceBlock evidence={data.evidence} />
          </div>
        )}
      </div>
    </SectionCard>
  );
}




