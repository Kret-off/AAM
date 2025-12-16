'use client';

import { useState, useEffect } from 'react';
import { apiGet, apiPatch } from '@/lib/api-client';
import { ScenarioResponse, MeetingTypeResponse } from '@/lib/scenario/dto';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { X } from 'lucide-react';

interface EditScenarioModalProps {
  scenarioId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditScenarioModal({
  scenarioId,
  onClose,
  onSuccess,
}: EditScenarioModalProps) {
  const [formData, setFormData] = useState({
    meetingTypeId: '',
    name: '',
    systemPrompt: '',
    outputSchema: '{}',
    artifactsConfig: '{}',
    keyterms: '',
    isActive: true,
  });
  const [meetingTypes, setMeetingTypes] = useState<{ id: string; name: string }[]>([]);
  const [isLoadingTypes, setIsLoadingTypes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadMeetingTypes();
    loadScenario();
  }, [scenarioId]);

  const loadMeetingTypes = async () => {
    setIsLoadingTypes(true);
    try {
      const response = await apiGet<{ items: MeetingTypeResponse[] }>(
        '/api/meeting-types?pageSize=100'
      );
      if (response.data) {
        setMeetingTypes(response.data.items || []);
      }
    } catch (err) {
      console.error('Failed to load meeting types:', err);
    } finally {
      setIsLoadingTypes(false);
    }
  };

  const loadScenario = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiGet<ScenarioResponse>(
        `/api/scenarios/${scenarioId}`
      );

      if (response.error) {
        setError(response.error.message || 'Ошибка загрузки сценария');
        setIsLoading(false);
        return;
      }

      if (response.data) {
        setFormData({
          meetingTypeId: response.data.meetingTypeId,
          name: response.data.name,
          systemPrompt: response.data.systemPrompt,
          outputSchema: JSON.stringify(response.data.outputSchema, null, 2),
          artifactsConfig: JSON.stringify(response.data.artifactsConfig, null, 2),
          keyterms: response.data.keyterms?.join(', ') || '',
          isActive: response.data.isActive,
        });
      }
    } catch (err) {
      setError('Произошла ошибка при загрузке сценария');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate JSON
    let parsedOutputSchema;
    let parsedArtifactsConfig;
    try {
      parsedOutputSchema = JSON.parse(formData.outputSchema);
      parsedArtifactsConfig = JSON.parse(formData.artifactsConfig);
    } catch (err) {
      setError('Неверный формат JSON в схеме или конфигурации');
      return;
    }

    // Parse keyterms
    const keytermsArray = formData.keyterms
      .split(',')
      .map((term) => term.trim())
      .filter((term) => term.length > 0);

    setIsSubmitting(true);

    try {
      const response = await apiPatch<ScenarioResponse>(
        `/api/scenarios/${scenarioId}`,
        {
          meetingTypeId: formData.meetingTypeId,
          name: formData.name,
          systemPrompt: formData.systemPrompt,
          outputSchema: parsedOutputSchema,
          artifactsConfig: parsedArtifactsConfig,
          keyterms: keytermsArray,
          isActive: formData.isActive,
        }
      );

      if (response.error) {
        setError(response.error.message || 'Ошибка обновления сценария');
        setIsSubmitting(false);
        return;
      }

      onSuccess();
    } catch (err) {
      setError('Произошла ошибка при обновлении сценария');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col">
        <CardHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle>Редактировать сценарий</CardTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <LoadingSpinner size="lg" />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="meetingTypeId">Тип встречи</Label>
                  {isLoadingTypes ? (
                    <div className="flex items-center justify-center py-2">
                      <LoadingSpinner size="sm" />
                    </div>
                  ) : (
                    <select
                      id="meetingTypeId"
                      value={formData.meetingTypeId}
                      onChange={(e) =>
                        setFormData({ ...formData, meetingTypeId: e.target.value })
                      }
                      className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                      required
                      disabled={isSubmitting}
                    >
                      <option value="">Выберите тип встречи</option>
                      {meetingTypes.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Название</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="systemPrompt">Системный промпт</Label>
                  <textarea
                    id="systemPrompt"
                    value={formData.systemPrompt}
                    onChange={(e) =>
                      setFormData({ ...formData, systemPrompt: e.target.value })
                    }
                    required
                    disabled={isSubmitting}
                    rows={5}
                    className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm resize-y"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="outputSchema">Схема вывода (JSON)</Label>
                  <textarea
                    id="outputSchema"
                    value={formData.outputSchema}
                    onChange={(e) =>
                      setFormData({ ...formData, outputSchema: e.target.value })
                    }
                    required
                    disabled={isSubmitting}
                    rows={6}
                    className="font-mono text-sm flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 resize-y"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="artifactsConfig">Конфигурация артефактов (JSON)</Label>
                  <textarea
                    id="artifactsConfig"
                    value={formData.artifactsConfig}
                    onChange={(e) =>
                      setFormData({ ...formData, artifactsConfig: e.target.value })
                    }
                    required
                    disabled={isSubmitting}
                    rows={5}
                    className="font-mono text-sm flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 resize-y"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="keyterms">Ключевые термины (через запятую)</Label>
                  <Input
                    id="keyterms"
                    value={formData.keyterms}
                    onChange={(e) =>
                      setFormData({ ...formData, keyterms: e.target.value })
                    }
                    disabled={isSubmitting}
                    placeholder="термин1, термин2, термин3"
                  />
                  <p className="text-xs text-gray-500">
                    Введите ключевые термины через запятую
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) =>
                      setFormData({ ...formData, isActive: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-gray-300"
                    disabled={isSubmitting}
                  />
                  <Label htmlFor="isActive" className="cursor-pointer">
                    Активен
                  </Label>
                </div>

                <div className="flex gap-2 flex-shrink-0 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    className="flex-1"
                    disabled={isSubmitting}
                  >
                    Отмена
                  </Button>
                  <Button type="submit" className="flex-1" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <LoadingSpinner size="sm" className="mr-2" />
                        Сохранение...
                      </>
                    ) : (
                      'Сохранить'
                    )}
                  </Button>
                </div>
              </>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
