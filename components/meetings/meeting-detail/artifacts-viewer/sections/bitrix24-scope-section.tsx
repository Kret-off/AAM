'use client';

import { Bitrix24ScopeDraft } from '@/lib/artifacts/types';
import { SectionCard } from '../components/section-card';
import { Package } from 'lucide-react';

interface Bitrix24ScopeSectionProps {
  data: Bitrix24ScopeDraft | undefined;
}

const workBlockLabels: Record<string, string> = {
  discovery: 'Discovery',
  setup: 'Настройка',
  crm_pipeline: 'CRM Pipeline',
  automation: 'Автоматизация',
  communications: 'Коммуникации',
  telephony: 'Телефония',
  forms: 'Формы',
  open_lines: 'Открытые линии',
  tasks_projects: 'Задачи и проекты',
  reports: 'Отчеты',
  integrations: 'Интеграции',
  migration: 'Миграция',
  training: 'Обучение',
  support: 'Поддержка',
  other: 'Другое',
};

export function Bitrix24ScopeSection({ data }: Bitrix24ScopeSectionProps) {
  if (!data) {
    return null;
  }

  const hasData = data.license || data.work_blocks?.length;

  if (!hasData) {
    return null;
  }

  return (
    <SectionCard title="Bitrix24 Scope" icon={<Package className="h-5 w-5" />}>
      <div className="space-y-4">
        {data.license && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Лицензия</p>
            {data.license.needs && (
              <div className="mb-2">
                <p className="text-xs text-gray-500 mb-1">Требуется:</p>
                <p className="text-sm text-gray-600">{data.license.needs}</p>
              </div>
            )}
            {data.license.preferred && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Предпочтительно:</p>
                <p className="text-sm text-gray-600">{data.license.preferred}</p>
              </div>
            )}
          </div>
        )}

        {data.work_blocks && data.work_blocks.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Рабочие блоки</p>
            <div className="space-y-3">
              {data.work_blocks.map((block, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-gray-900 mb-2">
                    {workBlockLabels[block.block] || block.block}
                  </p>
                  {block.items && block.items.length > 0 && (
                    <ul className="text-sm text-gray-600 space-y-1">
                      {block.items.map((item, itemIdx) => (
                        <li key={itemIdx}>• {item}</li>
                      ))}
                    </ul>
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







