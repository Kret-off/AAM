'use client';

import { ScenarioResponse } from '@/lib/scenario/dto';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, Edit, Trash2 } from 'lucide-react';

interface ScenariosListProps {
  scenarios: ScenarioResponse[];
  onUpdate: () => void;
  onView?: (scenario: ScenarioResponse) => void;
  onEdit?: (scenario: ScenarioResponse) => void;
  onDelete?: (scenario: ScenarioResponse) => void;
}

export function ScenariosList({ scenarios, onView, onEdit, onDelete }: ScenariosListProps) {
  if (scenarios.length === 0) {
    return <p className="text-sm text-gray-500">Сценарии не найдены</p>;
  }

  return (
    <div className="space-y-2">
      {scenarios.map((scenario) => (
        <div
          key={scenario.id}
          className="rounded-lg border border-gray-200 p-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{scenario.name}</span>
                {!scenario.isActive && (
                  <Badge variant="secondary">Неактивен</Badge>
                )}
              </div>
              <div className="text-sm text-gray-500 mt-1">
                {scenario.meetingTypeName} • Версия {scenario.version}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {onView && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onView(scenario)}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Просмотр
                </Button>
              )}
              {onEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(scenario)}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Редактировать
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDelete(scenario)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Удалить
                </Button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}


