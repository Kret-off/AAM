'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet } from '@/lib/api-client';
import { ClientDetailResponse } from '@/lib/client-kb/dto';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MeetingCard } from '@/components/meetings/meeting-card';
import { TransferOwnershipModal } from './transfer-ownership-modal';
import { EditClientModal } from './edit-client-modal';
import { format } from 'date-fns';

interface ClientDetailProps {
  clientId: string;
}

export function ClientDetail({ clientId }: ClientDetailProps) {
  const router = useRouter();
  const [client, setClient] = useState<ClientDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  useEffect(() => {
    loadClient();
  }, [clientId]);

  const loadClient = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiGet<ClientDetailResponse>(
        `/api/clients/${clientId}`
      );

      if (response.error) {
        setError(response.error.message || 'Ошибка загрузки клиента');
        setIsLoading(false);
        return;
      }

      if (response.data) {
        setClient(response.data);
      }
    } catch (err) {
      setError('Произошла ошибка при загрузке клиента');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !client) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error || 'Клиент не найден'}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{client.name}</h1>
          <div className="mt-2 flex items-center gap-4">
            <span className="text-sm text-gray-600">
              Создано: {format(new Date(client.createdAt), 'dd MMM yyyy, HH:mm')}
            </span>
            {client.updatedAt !== client.createdAt && (
              <span className="text-sm text-gray-600">
                Обновлено: {format(new Date(client.updatedAt), 'dd MMM yyyy, HH:mm')}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsEditModalOpen(true)}>
            Редактировать
          </Button>
          <Button variant="outline" onClick={() => setIsTransferModalOpen(true)}>
            Передать владение
          </Button>
          <Button variant="outline" onClick={() => router.back()}>
            Назад
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Информация о клиенте</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm font-medium text-gray-500">ID клиента</div>
              <div className="mt-1 text-sm text-gray-900">{client.id}</div>
            </div>
            {client.createdByUserName && (
              <div>
                <div className="text-sm font-medium text-gray-500">Создан пользователем</div>
                <div className="mt-1 text-sm text-gray-900">{client.createdByUserName}</div>
              </div>
            )}
            {client.meetingsCount !== undefined && (
              <div>
                <div className="text-sm font-medium text-gray-500">Количество встреч</div>
                <div className="mt-1 text-sm text-gray-900">{client.meetingsCount}</div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Даты</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm font-medium text-gray-500">Дата создания</div>
              <div className="mt-1 text-sm text-gray-900">
                {format(new Date(client.createdAt), 'dd MMM yyyy, HH:mm:ss')}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500">Дата обновления</div>
              <div className="mt-1 text-sm text-gray-900">
                {format(new Date(client.updatedAt), 'dd MMM yyyy, HH:mm:ss')}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Встречи клиента</CardTitle>
          <CardDescription>
            Список всех встреч, привязанных к этому клиенту
          </CardDescription>
        </CardHeader>
        <CardContent>
          {client.meetings && client.meetings.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {client.meetings.map((meeting) => (
                <MeetingCard key={meeting.id} meeting={meeting} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              У этого клиента пока нет встреч
            </p>
          )}
        </CardContent>
      </Card>

      {client.contextSummary && (
        <Card>
          <CardHeader>
            <CardTitle>Контекст клиента</CardTitle>
            <CardDescription>
              Сводка контекста клиента, обновляемая при принятии встреч
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="prose max-w-none whitespace-pre-wrap text-sm text-gray-700">
              {client.contextSummary}
            </div>
          </CardContent>
        </Card>
      )}

      {!client.contextSummary && (
        <Card>
          <CardHeader>
            <CardTitle>Контекст клиента</CardTitle>
            <CardDescription>
              Контекст будет обновлен после принятия первой встречи
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500">Контекст клиента пока не создан</p>
          </CardContent>
        </Card>
      )}

      {isTransferModalOpen && (
        <TransferOwnershipModal
          clientId={clientId}
          onClose={() => setIsTransferModalOpen(false)}
          onSuccess={() => {
            setIsTransferModalOpen(false);
            loadClient();
          }}
        />
      )}

      {isEditModalOpen && (
        <EditClientModal
          clientId={clientId}
          onClose={() => setIsEditModalOpen(false)}
          onSuccess={() => {
            setIsEditModalOpen(false);
            loadClient();
          }}
        />
      )}
    </div>
  );
}





