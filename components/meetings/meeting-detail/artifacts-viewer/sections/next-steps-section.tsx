'use client';

import { SectionCard } from '../components/section-card';
import { ArrowRight, User, Users, Lightbulb } from 'lucide-react';

interface NextStepsData {
  manager_actions?: string[];
  client_actions?: string[];
  model_recommendations_for_manager?: string[];
}

interface NextStepsSectionProps {
  data: NextStepsData | undefined;
}

export function NextStepsSection({ data }: NextStepsSectionProps) {
  if (!data) {
    return null;
  }

  const hasData =
    (data.manager_actions && data.manager_actions.length > 0) ||
    (data.client_actions && data.client_actions.length > 0) ||
    (data.model_recommendations_for_manager && data.model_recommendations_for_manager.length > 0);

  if (!hasData) {
    return null;
  }

  return (
    <SectionCard title="Следующие шаги" icon={<ArrowRight className="h-5 w-5" />}>
      <div className="space-y-5">
        {data.manager_actions && data.manager_actions.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <User className="h-4 w-4 text-blue-600" />
              <p className="text-sm font-semibold text-gray-900">Действия менеджера:</p>
            </div>
            <ul className="space-y-2">
              {data.manager_actions.map((action, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-blue-600 mt-1">•</span>
                  <span>{action}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {data.client_actions && data.client_actions.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4 text-green-600" />
              <p className="text-sm font-semibold text-gray-900">Действия клиента:</p>
            </div>
            <ul className="space-y-2">
              {data.client_actions.map((action, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-green-600 mt-1">•</span>
                  <span>{action}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {data.model_recommendations_for_manager && data.model_recommendations_for_manager.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="h-4 w-4 text-yellow-600" />
              <p className="text-sm font-semibold text-gray-900">Рекомендации модели:</p>
            </div>
            <ul className="space-y-2">
              {data.model_recommendations_for_manager.map((recommendation, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-yellow-600 mt-1">•</span>
                  <span>{recommendation}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </SectionCard>
  );
}




