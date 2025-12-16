'use client';

import { ScenarioResponse } from '@/lib/scenario/dto';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, Edit } from 'lucide-react';

interface ViewScenarioModalProps {
  scenario: ScenarioResponse;
  onClose: () => void;
  onEdit?: () => void;
}

export function ViewScenarioModal({
  scenario,
  onClose,
  onEdit,
}: ViewScenarioModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] flex flex-col">
        <CardHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle>Просмотр сценария</CardTitle>
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
                <p className="mt-1 text-sm text-gray-900">{scenario.name}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Тип встречи</label>
                <p className="mt-1 text-sm text-gray-900">{scenario.meetingTypeName}</p>
              </div>

              <div className="flex items-center gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Статус</label>
                  <div className="mt-1">
                    {scenario.isActive ? (
                      <Badge variant="default">Активен</Badge>
                    ) : (
                      <Badge variant="secondary">Неактивен</Badge>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Версия</label>
                  <p className="mt-1 text-sm text-gray-900">{scenario.version}</p>
                </div>
              </div>

              {scenario.updatedByUserName && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Обновлено</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {new Date(scenario.updatedAt).toLocaleString('ru-RU')} пользователем {scenario.updatedByUserName}
                  </p>
                </div>
              )}
            </div>

            {/* System Prompt */}
            <div>
              <label className="text-sm font-medium text-gray-700">Системный промпт</label>
              <div className="mt-1 p-3 bg-gray-50 rounded-md border border-gray-200 max-h-48 overflow-y-auto">
                <pre className="text-sm text-gray-900 whitespace-pre-wrap font-sans">
                  {scenario.systemPrompt}
                </pre>
              </div>
            </div>

            {/* Output Schema */}
            <div>
              <label className="text-sm font-medium text-gray-700">Схема вывода (JSON)</label>
              <div className="mt-1 p-3 bg-gray-50 rounded-md border border-gray-200 max-h-64 overflow-auto">
                <pre className="text-sm text-gray-900 whitespace-pre-wrap font-mono">
                  {JSON.stringify(scenario.outputSchema, null, 2)}
                </pre>
              </div>
            </div>

            {/* Artifacts Config */}
            <div>
              <label className="text-sm font-medium text-gray-700">Конфигурация артефактов (JSON)</label>
              <div className="mt-1 p-3 bg-gray-50 rounded-md border border-gray-200 max-h-64 overflow-auto">
                <pre className="text-sm text-gray-900 whitespace-pre-wrap font-mono">
                  {JSON.stringify(scenario.artifactsConfig, null, 2)}
                </pre>
              </div>
            </div>

            {/* Keyterms */}
            <div>
              <label className="text-sm font-medium text-gray-700">Ключевые термины</label>
              {scenario.keyterms && scenario.keyterms.length > 0 ? (
                <div className="mt-1 flex flex-wrap gap-2">
                  {scenario.keyterms.map((term, index) => (
                    <Badge key={index} variant="outline">
                      {term}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-sm text-gray-500">Нет ключевых терминов</p>
              )}
            </div>

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






