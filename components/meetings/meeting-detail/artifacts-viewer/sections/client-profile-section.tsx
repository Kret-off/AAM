'use client';

import { ClientProfile } from '@/lib/artifacts/types';
import { SectionCard } from '../components/section-card';
import { Building2, Briefcase, MapPin, Wrench, Users } from 'lucide-react';

interface ClientProfileSectionProps {
  data: ClientProfile | undefined;
}

export function ClientProfileSection({ data }: ClientProfileSectionProps) {
  if (!data) {
    return null;
  }

  const hasData =
    data.company_name ||
    data.industry ||
    data.business_model ||
    data.geo ||
    data.current_tools?.length ||
    data.team_size_or_users;

  if (!hasData) {
    return null;
  }

  return (
    <SectionCard title="Профиль клиента" icon={<Building2 className="h-5 w-5" />}>
      <div className="space-y-4">
        {data.company_name && (
          <div className="flex items-start gap-3">
            <Building2 className="h-4 w-4 mt-0.5 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-700">Название компании</p>
              <p className="text-sm text-gray-600">{data.company_name}</p>
            </div>
          </div>
        )}

        {data.industry && (
          <div className="flex items-start gap-3">
            <Briefcase className="h-4 w-4 mt-0.5 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-700">Индустрия</p>
              <p className="text-sm text-gray-600">{data.industry}</p>
            </div>
          </div>
        )}

        {data.business_model && (
          <div className="flex items-start gap-3">
            <Briefcase className="h-4 w-4 mt-0.5 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-700">Бизнес-модель</p>
              <p className="text-sm text-gray-600">{data.business_model}</p>
            </div>
          </div>
        )}

        {data.geo && (
          <div className="flex items-start gap-3">
            <MapPin className="h-4 w-4 mt-0.5 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-700">География</p>
              <p className="text-sm text-gray-600">{data.geo}</p>
            </div>
          </div>
        )}

        {data.team_size_or_users && (
          <div className="flex items-start gap-3">
            <Users className="h-4 w-4 mt-0.5 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-700">Размер команды / Пользователи</p>
              <p className="text-sm text-gray-600">
                {data.team_size_or_users.value}
                {data.team_size_or_users.unit && ` ${data.team_size_or_users.unit}`}
              </p>
            </div>
          </div>
        )}

        {data.current_tools && data.current_tools.length > 0 && (
          <div className="flex items-start gap-3">
            <Wrench className="h-4 w-4 mt-0.5 text-gray-400" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-700 mb-2">Текущие инструменты</p>
              <ul className="text-sm text-gray-600 space-y-1">
                {data.current_tools.map((tool, idx) => (
                  <li key={idx}>• {tool}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}







