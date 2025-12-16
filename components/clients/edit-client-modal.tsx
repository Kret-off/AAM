'use client';

import { useState, useEffect } from 'react';
import { apiGet, apiPatch } from '@/lib/api-client';
import { ClientDetailResponse } from '@/lib/client-kb/dto';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { X } from 'lucide-react';

interface EditClientModalProps {
  clientId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditClientModal({
  clientId,
  onClose,
  onSuccess,
}: EditClientModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    contextSummary: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadClient();
  }, [clientId]);

  const loadClient = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiGet<ClientDetailResponse>(`/api/clients/${clientId}`);

      if (response.error) {
        setError(response.error.message || 'Ошибка загрузки клиента');
        setIsLoading(false);
        return;
      }

      if (response.data) {
        setFormData({
          name: response.data.name || '',
          contextSummary: response.data.contextSummary || '',
        });
      }
    } catch (err) {
      setError('Произошла ошибка при загрузке клиента');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError('Название клиента обязательно для заполнения');
      return;
    }

    setIsSubmitting(true);

    try {
      const updateData: {
        name?: string;
        contextSummary?: string;
      } = {
        name: formData.name.trim(),
        contextSummary: formData.contextSummary.trim() || null,
      };

      const response = await apiPatch<ClientDetailResponse>(
        `/api/clients/${clientId}`,
        updateData
      );

      if (response.error) {
        setError(response.error.message || 'Ошибка обновления клиента');
        setIsSubmitting(false);
        return;
      }

      onSuccess();
    } catch (err) {
      setError('Произошла ошибка при обновлении клиента');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col">
        <CardHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle>Редактировать клиента</CardTitle>
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
                  <Label htmlFor="name">Название клиента</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                    disabled={isSubmitting}
                    placeholder="Введите название клиента"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contextSummary">Контекст клиента</Label>
                  <textarea
                    id="contextSummary"
                    value={formData.contextSummary}
                    onChange={(e) =>
                      setFormData({ ...formData, contextSummary: e.target.value })
                    }
                    disabled={isSubmitting}
                    rows={10}
                    className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm resize-y"
                    placeholder="Введите контекст клиента (Markdown)"
                  />
                  <p className="text-xs text-gray-500">
                    Контекст клиента в формате Markdown
                  </p>
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

