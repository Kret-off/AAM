'use client';

import { useState, useEffect } from 'react';
import { apiGet, apiPost } from '@/lib/api-client';
import { MeetingTypeResponse } from '@/lib/scenario/dto';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { X } from 'lucide-react';

interface CreateScenarioModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateScenarioModal({
  onClose,
  onSuccess,
}: CreateScenarioModalProps) {
  const [meetingTypes, setMeetingTypes] = useState<MeetingTypeResponse[]>([]);
  const [formData, setFormData] = useState({
    meetingTypeId: '',
    name: '',
    systemPrompt: '',
    outputSchema: '{}',
    artifactsConfig: '{}',
    isActive: true,
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingTypes, setIsLoadingTypes] = useState(true);

  useEffect(() => {
    loadMeetingTypes();
  }, []);

  const loadMeetingTypes = async () => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate JSON
    try {
      JSON.parse(formData.outputSchema);
      JSON.parse(formData.artifactsConfig);
    } catch (err) {
      setError('Неверный формат JSON в схеме или конфигурации');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await apiPost<{ scenario: { id: string } }>(
        '/api/scenarios',
        {
          ...formData,
          outputSchema: JSON.parse(formData.outputSchema),
          artifactsConfig: JSON.parse(formData.artifactsConfig),
        }
      );

      if (response.error) {
        setError(response.error.message || 'Ошибка создания сценария');
        setIsSubmitting(false);
        return;
      }

      onSuccess();
    } catch (err) {
      setError('Произошла ошибка при создании сценария');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto">
      <Card className="w-full max-w-2xl my-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Создать сценарий</CardTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {isLoadingTypes ? (
              <div className="flex items-center justify-center py-8">
                <LoadingSpinner size="lg" />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="meetingTypeId">Тип встречи</Label>
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
                    rows={6}
                    className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
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
                    rows={8}
                    className="font-mono text-sm flex w-full rounded-md border border-gray-300 bg-white px-3 py-2"
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
                    rows={6}
                    className="font-mono text-sm flex w-full rounded-md border border-gray-300 bg-white px-3 py-2"
                  />
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

                <div className="flex gap-2">
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
                        Создание...
                      </>
                    ) : (
                      'Создать'
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








