'use client';

import { NumbersAndTerms } from '@/lib/artifacts/types';
import { SectionCard } from '../components/section-card';
import { DollarSign, Clock, Users } from 'lucide-react';

interface NumbersTermsSectionProps {
  data: NumbersAndTerms | undefined;
}

export function NumbersTermsSection({ data }: NumbersTermsSectionProps) {
  if (!data) {
    return null;
  }

  const hasData = data.budget || data.timeline || data.users_count || data.notes?.length;

  if (!hasData) {
    return null;
  }

  return (
    <SectionCard title="Бюджет и сроки" icon={<DollarSign className="h-5 w-5" />}>
      <div className="space-y-4">
        {data.budget && (
          <div className="flex items-start gap-3">
            <DollarSign className="h-4 w-4 mt-0.5 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-700">Бюджет</p>
              <p className="text-sm text-gray-600">
                {data.budget.value}
                {data.budget.currency && ` ${data.budget.currency}`}
              </p>
            </div>
          </div>
        )}

        {data.timeline && (
          <div className="flex items-start gap-3">
            <Clock className="h-4 w-4 mt-0.5 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-700">Сроки</p>
              <p className="text-sm text-gray-600">
                {data.timeline.value}
                {data.timeline.unit && ` ${data.timeline.unit}`}
              </p>
            </div>
          </div>
        )}

        {data.users_count && (
          <div className="flex items-start gap-3">
            <Users className="h-4 w-4 mt-0.5 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-700">Количество пользователей</p>
              <p className="text-sm text-gray-600">
                {data.users_count.value}
                {data.users_count.unit && ` ${data.users_count.unit}`}
              </p>
            </div>
          </div>
        )}

        {data.notes && data.notes.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Заметки</p>
            <ul className="text-sm text-gray-600 space-y-1">
              {data.notes.map((note, idx) => (
                <li key={idx}>• {note}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </SectionCard>
  );
}







