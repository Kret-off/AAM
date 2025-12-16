'use client';

import { DecisionAndStakeholders } from '@/lib/artifacts/types';
import { SectionCard } from '../components/section-card';
import { UserCheck, Users, FileText } from 'lucide-react';
import { EvidenceBlock } from '../components/evidence-block';

interface DecisionStakeholdersSectionProps {
  data: DecisionAndStakeholders | undefined;
}

export function DecisionStakeholdersSection({ data }: DecisionStakeholdersSectionProps) {
  if (!data) {
    return null;
  }

  const hasData =
    data.decision_maker ||
    data.users?.length ||
    data.roles_notes?.length ||
    data.evidence?.length;

  if (!hasData) {
    return null;
  }

  return (
    <SectionCard title="Решения и стейкхолдеры" icon={<UserCheck className="h-5 w-5" />}>
      <div className="space-y-4">
        {data.decision_maker && (
          <div className="flex items-start gap-3">
            <UserCheck className="h-4 w-4 mt-0.5 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-700">Лицо, принимающее решение</p>
              <p className="text-sm text-gray-600">{data.decision_maker}</p>
            </div>
          </div>
        )}

        {data.users && data.users.length > 0 && (
          <div className="flex items-start gap-3">
            <Users className="h-4 w-4 mt-0.5 text-gray-400" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-700 mb-2">Пользователи</p>
              <ul className="text-sm text-gray-600 space-y-1">
                {data.users.map((user, idx) => (
                  <li key={idx}>• {user}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {data.roles_notes && data.roles_notes.length > 0 && (
          <div className="flex items-start gap-3">
            <FileText className="h-4 w-4 mt-0.5 text-gray-400" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-700 mb-2">Заметки о ролях</p>
              <ul className="text-sm text-gray-600 space-y-1">
                {data.roles_notes.map((note, idx) => (
                  <li key={idx}>• {note}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {data.evidence && data.evidence.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700">Доказательства</p>
            {data.evidence.map((ev, idx) => {
              // Try to parse evidence as Evidence type
              const evidence = ev as { quote?: string; speaker?: string };
              if (evidence.quote && evidence.speaker) {
                return (
                  <EvidenceBlock
                    key={idx}
                    evidence={{
                      quote: evidence.quote,
                      speaker: evidence.speaker as 'client' | 'our_team' | 'unknown',
                    }}
                  />
                );
              }
              return null;
            })}
          </div>
        )}
      </div>
    </SectionCard>
  );
}







