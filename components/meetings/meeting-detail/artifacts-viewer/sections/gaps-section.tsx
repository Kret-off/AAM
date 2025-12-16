'use client';

import { GapsForRegeneration } from '@/lib/artifacts/types';
import { SectionCard } from '../components/section-card';
import { AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface GapsSectionProps {
  data: GapsForRegeneration | undefined;
}

const severityLabels: Record<string, string> = {
  critical: 'Критично',
  important: 'Важно',
  nice_to_have: 'Желательно',
};

const severityColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 border-red-200',
  important: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  nice_to_have: 'bg-green-100 text-green-800 border-green-200',
};

export function GapsSection({ data }: GapsSectionProps) {
  if (!data) {
    return null;
  }

  const hasData =
    data.missing_data_items?.length || data.cannot_determine_from_transcript?.length;

  if (!hasData) {
    return null;
  }

  return (
    <SectionCard title="Пробелы для регенерации" icon={<AlertCircle className="h-5 w-5" />}>
      <div className="space-y-4">
        {data.missing_data_items && data.missing_data_items.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Отсутствующие данные</p>
            <div className="space-y-3">
              {data.missing_data_items.map((item, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-semibold text-gray-900 flex-1">{item.item}</h4>
                    <Badge
                      variant="outline"
                      className={`border ${severityColors[item.severity]}`}
                    >
                      {severityLabels[item.severity] || item.severity}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500">
                    Зачем нужно для предложения: {item.why_needed_for_proposal}
                  </p>
                  <p className="text-xs text-gray-500">
                    Связанная секция: {item.linked_section}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.cannot_determine_from_transcript &&
          data.cannot_determine_from_transcript.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">
                Нельзя определить из транскрипта
              </p>
              <ul className="text-sm text-gray-600 space-y-1">
                {data.cannot_determine_from_transcript.map((item, idx) => (
                  <li key={idx}>• {item}</li>
                ))}
              </ul>
            </div>
          )}
      </div>
    </SectionCard>
  );
}







