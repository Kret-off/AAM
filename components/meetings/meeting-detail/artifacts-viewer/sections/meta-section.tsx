'use client';

import { MetaData } from '@/lib/artifacts/types';
import { SectionCard } from '../components/section-card';
import { Calendar, Users, Tag, MapPin } from 'lucide-react';

interface MetaSectionProps {
  data: MetaData | undefined;
}

/**
 * Format participant data - handles both string and object formats
 */
function formatParticipant(participant: string | { name?: string; role?: string; company?: string; department?: string }): string {
  if (typeof participant === 'string') {
    return participant;
  }
  // Handle object format
  const parts: string[] = [];
  if (participant.name) parts.push(participant.name);
  if (participant.role) parts.push(`(${participant.role})`);
  if (participant.company) parts.push(`- ${participant.company}`);
  if (participant.department) parts.push(`[${participant.department}]`);
  return parts.length > 0 ? parts.join(' ') : 'Участник';
}

export function MetaSection({ data }: MetaSectionProps) {
  if (!data) {
    return null;
  }

  const hasData =
    data.brand ||
    data.meeting_date ||
    data.deal_stage ||
    data.source ||
    data.participants?.client?.length ||
    data.participants?.our_team?.length;

  if (!hasData) {
    return null;
  }

  return (
    <SectionCard title="Метаданные встречи" icon={<Calendar className="h-5 w-5" />}>
      <div className="space-y-4">
        {data.brand && (
          <div className="flex items-start gap-3">
            <Tag className="h-4 w-4 mt-0.5 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-700">Бренд</p>
              <p className="text-sm text-gray-600">{data.brand}</p>
            </div>
          </div>
        )}

        {data.meeting_date && (
          <div className="flex items-start gap-3">
            <Calendar className="h-4 w-4 mt-0.5 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-700">Дата встречи</p>
              <p className="text-sm text-gray-600">{data.meeting_date}</p>
            </div>
          </div>
        )}

        {data.deal_stage && (
          <div className="flex items-start gap-3">
            <Tag className="h-4 w-4 mt-0.5 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-700">Стадия сделки</p>
              <p className="text-sm text-gray-600">{data.deal_stage}</p>
            </div>
          </div>
        )}

        {data.source && (
          <div className="flex items-start gap-3">
            <MapPin className="h-4 w-4 mt-0.5 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-700">Источник</p>
              <p className="text-sm text-gray-600">{data.source}</p>
            </div>
          </div>
        )}

        {(data.participants?.client?.length || data.participants?.our_team?.length) && (
          <div className="flex items-start gap-3">
            <Users className="h-4 w-4 mt-0.5 text-gray-400" />
            <div className="flex-1 space-y-2">
              <p className="text-sm font-medium text-gray-700">Участники</p>
              {data.participants?.client && data.participants.client.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Клиент:</p>
                  <ul className="text-sm text-gray-600 space-y-1">
                    {data.participants.client.map((participant, idx) => (
                      <li key={idx}>• {formatParticipant(participant as string | { name?: string; role?: string; company?: string; department?: string })}</li>
                    ))}
                  </ul>
                </div>
              )}
              {data.participants?.our_team && data.participants.our_team.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Наша команда:</p>
                  <ul className="text-sm text-gray-600 space-y-1">
                    {data.participants.our_team.map((participant, idx) => (
                      <li key={idx}>• {formatParticipant(participant as string | { name?: string; role?: string; company?: string; department?: string })}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

