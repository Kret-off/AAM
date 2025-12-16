'use client';

import { Evidence, SpeakerType } from '@/lib/artifacts/types';
import { Badge } from '@/components/ui/badge';

interface EvidenceBlockProps {
  evidence: Evidence;
  className?: string;
}

const speakerLabels: Record<SpeakerType, string> = {
  client: 'Клиент',
  our_team: 'Наша команда',
  unknown: 'Неизвестно',
};

const speakerColors: Record<SpeakerType, string> = {
  client: 'bg-blue-100 text-blue-800 border-blue-200',
  our_team: 'bg-green-100 text-green-800 border-green-200',
  unknown: 'bg-gray-100 text-gray-800 border-gray-200',
};

export function EvidenceBlock({ evidence, className }: EvidenceBlockProps) {
  return (
    <div className={`space-y-2 ${className || ''}`}>
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
        <p className="text-gray-700 italic">"{evidence.quote}"</p>
      </div>
      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          className={`border ${speakerColors[evidence.speaker]}`}
        >
          {speakerLabels[evidence.speaker]}
        </Badge>
      </div>
    </div>
  );
}







