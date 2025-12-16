'use client';

import { ChannelsAndIntegrations } from '@/lib/artifacts/types';
import { SectionCard } from '../components/section-card';
import { MessageSquare, Plug } from 'lucide-react';
import { EvidenceBlock } from '../components/evidence-block';

interface ChannelsIntegrationsSectionProps {
  data: ChannelsAndIntegrations | undefined;
}

const channelLabels: Record<string, string> = {
  site: 'Сайт',
  avito: 'Авито',
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  email: 'Email',
  phone: 'Телефон',
  other: 'Другое',
};

const directionLabels: Record<string, string> = {
  inbound: 'Входящая',
  outbound: 'Исходящая',
  both: 'Двусторонняя',
};

export function ChannelsIntegrationsSection({ data }: ChannelsIntegrationsSectionProps) {
  if (!data) {
    return null;
  }

  const hasData = data.channels?.length || data.integrations?.length;

  if (!hasData) {
    return null;
  }

  return (
    <SectionCard title="Каналы и интеграции" icon={<MessageSquare className="h-5 w-5" />}>
      <div className="space-y-6">
        {data.channels && data.channels.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="h-4 w-4 text-gray-400" />
              <p className="text-sm font-medium text-gray-700">Каналы</p>
            </div>
            <div className="space-y-3">
              {data.channels.map((channel, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      {channelLabels[channel.channel] || channel.channel}
                    </span>
                  </div>
                  {channel.details && (
                    <p className="text-sm text-gray-600">{channel.details}</p>
                  )}
                  {channel.raw_value && (
                    <p className="text-xs text-gray-500">Значение: {channel.raw_value}</p>
                  )}
                  {channel.evidence && (
                    <EvidenceBlock evidence={channel.evidence} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {data.integrations && data.integrations.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Plug className="h-4 w-4 text-gray-400" />
              <p className="text-sm font-medium text-gray-700">Интеграции</p>
            </div>
            <div className="space-y-3">
              {data.integrations.map((integration, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      {integration.system}
                    </span>
                    {integration.direction && (
                      <span className="text-xs text-gray-500">
                        ({directionLabels[integration.direction] || integration.direction})
                      </span>
                    )}
                  </div>
                  {integration.details && (
                    <p className="text-sm text-gray-600">{integration.details}</p>
                  )}
                  {integration.raw_value && (
                    <p className="text-xs text-gray-500">Значение: {integration.raw_value}</p>
                  )}
                  {integration.evidence && (
                    <EvidenceBlock evidence={integration.evidence} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}







