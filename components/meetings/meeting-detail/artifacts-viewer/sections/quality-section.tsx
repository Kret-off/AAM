'use client';

import { QualityData, QualityChecks } from '@/lib/artifacts/types';
import { SectionCard } from '../components/section-card';
import { CheckCircle2, AlertTriangle, HelpCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface QualitySectionProps {
  qualityData: QualityData | undefined;
  qualityChecks: QualityChecks | undefined;
}

const confidenceLabels: Record<string, string> = {
  high: 'Высокая',
  medium: 'Средняя',
  low: 'Низкая',
};

const confidenceColors: Record<string, string> = {
  high: 'bg-green-100 text-green-800 border-green-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  low: 'bg-red-100 text-red-800 border-red-200',
};

export function QualitySection({ qualityData, qualityChecks }: QualitySectionProps) {
  const hasData =
    qualityData?.missing_data_items?.length ||
    qualityData?.notes?.length ||
    qualityChecks?.ambiguous_phrases?.length ||
    qualityChecks?.confidence;

  if (!hasData) {
    return null;
  }

  return (
    <SectionCard title="Качество данных" icon={<CheckCircle2 className="h-5 w-5" />}>
      <div className="space-y-4">
        {qualityChecks?.confidence && (
          <div className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Уровень уверенности:</span>
            <Badge
              variant="outline"
              className={`border ${confidenceColors[qualityChecks.confidence]}`}
            >
              {confidenceLabels[qualityChecks.confidence] || qualityChecks.confidence}
            </Badge>
          </div>
        )}

        {qualityData?.missing_data_items && qualityData.missing_data_items.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <HelpCircle className="h-4 w-4 text-gray-400" />
              <p className="text-sm font-medium text-gray-700">Недостающие данные</p>
            </div>
            <ul className="text-sm text-gray-600 space-y-1">
              {qualityData.missing_data_items.map((item, idx) => (
                <li key={idx}>• {item}</li>
              ))}
            </ul>
          </div>
        )}

        {qualityData?.notes && qualityData.notes.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-4 w-4 text-gray-400" />
              <p className="text-sm font-medium text-gray-700">Заметки</p>
            </div>
            <ul className="text-sm text-gray-600 space-y-1">
              {qualityData.notes.map((note, idx) => (
                <li key={idx}>• {note}</li>
              ))}
            </ul>
          </div>
        )}

        {qualityChecks?.ambiguous_phrases && qualityChecks.ambiguous_phrases.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <p className="text-sm font-medium text-gray-700">Неоднозначные фразы</p>
            </div>
            <div className="space-y-2">
              {qualityChecks.ambiguous_phrases.map((phrase, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-gray-900 mb-1">
                    "{phrase.raw_fragment}"
                  </p>
                  <p className="text-xs text-gray-600">{phrase.why_ambiguous}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

