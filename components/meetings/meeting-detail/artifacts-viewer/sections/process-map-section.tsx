'use client';

import { ProcessMap } from '@/lib/artifacts/types';
import { SectionCard } from '../components/section-card';
import { Workflow, AlertTriangle } from 'lucide-react';

interface ProcessMapSectionProps {
  data: ProcessMap | undefined;
}

export function ProcessMapSection({ data }: ProcessMapSectionProps) {
  if (!data) {
    return null;
  }

  const hasData = data.as_is_steps?.length || data.bottlenecks?.length;

  if (!hasData) {
    return null;
  }

  return (
    <SectionCard title="Карта процессов" icon={<Workflow className="h-5 w-5" />}>
      <div className="space-y-4">
        {data.as_is_steps && data.as_is_steps.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Workflow className="h-4 w-4 text-gray-400" />
              <p className="text-sm font-medium text-gray-700">Текущие шаги (As-Is)</p>
            </div>
            <ol className="text-sm text-gray-600 space-y-1 ml-6 list-decimal">
              {data.as_is_steps.map((step, idx) => (
                <li key={idx}>{step}</li>
              ))}
            </ol>
          </div>
        )}

        {data.bottlenecks && data.bottlenecks.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <p className="text-sm font-medium text-gray-700">Узкие места</p>
            </div>
            <ul className="text-sm text-gray-600 space-y-1 ml-6 list-disc">
              {data.bottlenecks.map((bottleneck, idx) => (
                <li key={idx}>{bottleneck}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </SectionCard>
  );
}







