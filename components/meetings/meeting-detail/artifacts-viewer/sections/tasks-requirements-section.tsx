'use client';

import { TaskAndRequirement } from '@/lib/artifacts/types';
import { SectionCard } from '../components/section-card';
import { CheckSquare, X } from 'lucide-react';
import { EvidenceBlock } from '../components/evidence-block';
import { Badge } from '@/components/ui/badge';

interface TasksRequirementsSectionProps {
  data: TaskAndRequirement[] | undefined;
}

const categoryLabels: Record<string, string> = {
  sales: 'Продажи',
  service: 'Сервис',
  production: 'Производство',
  support: 'Поддержка',
  management: 'Управление',
  analytics: 'Аналитика',
  integration: 'Интеграции',
  other: 'Другое',
};

export function TasksRequirementsSection({ data }: TasksRequirementsSectionProps) {
  if (!data || data.length === 0) {
    return null;
  }

  return (
    <SectionCard title="Задачи и требования" icon={<CheckSquare className="h-5 w-5" />}>
      <div className="space-y-4">
        {data.map((task, idx) => (
          <div key={idx} className="border border-gray-200 rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-sm font-semibold text-gray-900 flex-1">{task.task}</h4>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {categoryLabels[task.category] || task.category}
                </Badge>
                {task.must_have !== null && task.must_have !== undefined && (
                  <div className="flex items-center gap-1">
                    {task.must_have ? (
                      <CheckSquare className="h-4 w-4 text-green-600" />
                    ) : (
                      <X className="h-4 w-4 text-gray-400" />
                    )}
                    <span className="text-xs text-gray-600">
                      {task.must_have ? 'Обязательно' : 'Не обязательно'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {task.details && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Детали:</p>
                <p className="text-sm text-gray-600">{task.details}</p>
              </div>
            )}

            {task.evidence && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Доказательство:</p>
                <EvidenceBlock evidence={task.evidence} />
              </div>
            )}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}







