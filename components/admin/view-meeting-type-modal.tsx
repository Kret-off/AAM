'use client';

import { useState, useEffect } from 'react';
import { apiGet } from '@/lib/api-client';
import { MeetingTypeResponse, ScenarioResponse } from '@/lib/scenario/dto';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { X, Edit, Eye } from 'lucide-react';

interface ViewMeetingTypeModalProps {
  meetingType: MeetingTypeResponse;
  onClose: () => void;
  onEdit?: () => void;
  onViewScenario?: (scenario: ScenarioResponse) => void;
}

export function ViewMeetingTypeModal({
  meetingType,
  onClose,
  onEdit,
  onViewScenario,
}: ViewMeetingTypeModalProps) {
  const [scenarios, setScenarios] = useState<ScenarioResponse[]>([]);
  const [isLoadingScenarios, setIsLoadingScenarios] = useState(false);

  useEffect(() => {
    if (meetingType.scenariosCount && meetingType.scenariosCount > 0) {
      loadScenarios();
    }
  }, [meetingType.id, meetingType.scenariosCount]);

  const loadScenarios = async () => {
    setIsLoadingScenarios(true);
    try {
      const response = await apiGet<{ items: ScenarioResponse[] }>(
        `/api/scenarios?meetingTypeId=${meetingType.id}&pageSize=100`
      );
      if (response.data) {
        setScenarios(response.data.items || []);
      }
    } catch (err) {
      console.error('Failed to load scenarios:', err);
    } finally {
      setIsLoadingScenarios(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] flex flex-col">
        <CardHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle>Просмотр типа встречи</CardTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto">
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Название</label>
                <p className="mt-1 text-sm text-gray-900">{meetingType.name}</p>
              </div>

              <div className="flex items-center gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Статус</label>
                  <div className="mt-1">
                    {meetingType.isActive ? (
                      <Badge variant="default">Активен</Badge>
                    ) : (
                      <Badge variant="secondary">Неактивен</Badge>
                    )}
                  </div>
                </div>
                {meetingType.scenariosCount !== undefined && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Сценариев</label>
                    <p className="mt-1 text-sm text-gray-900">{meetingType.scenariosCount}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Linked Scenarios */}
            {(meetingType.scenariosCount === undefined || meetingType.scenariosCount > 0) && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">
                    Связанные сценарии
                  </label>
                </div>
                
                {isLoadingScenarios ? (
                  <div className="flex items-center justify-center py-4">
                    <LoadingSpinner size="sm" />
                  </div>
                ) : scenarios.length > 0 ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-3">
                    {scenarios.map((scenario) => (
                      <div
                        key={scenario.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-md border border-gray-200"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{scenario.name}</span>
                            {!scenario.isActive && (
                              <Badge variant="secondary" className="text-xs">Неактивен</Badge>
                            )}
                            <Badge variant="outline" className="text-xs">
                              Версия {scenario.version}
                            </Badge>
                          </div>
                          {scenario.updatedByUserName && (
                            <div className="text-xs text-gray-500 mt-1">
                              Обновлено: {new Date(scenario.updatedAt).toLocaleDateString('ru-RU')} пользователем {scenario.updatedByUserName}
                            </div>
                          )}
                        </div>
                        {onViewScenario && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onViewScenario(scenario)}
                            className="ml-2"
                          >
                            <Eye className="mr-2 h-3 w-3" />
                            Просмотр
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : !isLoadingScenarios && meetingType.scenariosCount === 0 ? (
                  <p className="text-sm text-gray-500 py-4 text-center">
                    Нет связанных сценариев
                  </p>
                ) : null}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-4 border-t flex-shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1"
              >
                Закрыть
              </Button>
              {onEdit && (
                <Button
                  type="button"
                  onClick={onEdit}
                  className="flex-1"
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Редактировать
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}






