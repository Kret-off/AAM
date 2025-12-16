'use client';

import { useState, useEffect } from 'react';
import { apiGet, apiPost } from '@/lib/api-client';
import { ClientResponse, ClientsListResponse } from '@/lib/client-kb/dto';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CreateMeetingRequest } from '@/lib/meeting/dto';
import { X, Plus } from 'lucide-react';

interface ClientSelectorProps {
  formData: Partial<CreateMeetingRequest>;
  updateFormData: (data: Partial<CreateMeetingRequest>) => void;
  onNext: () => void;
}

export function ClientSelector({
  formData,
  updateFormData,
  onNext,
}: ClientSelectorProps) {
  const [clients, setClients] = useState<ClientResponse[]>([]);
  const [recentClients, setRecentClients] = useState<ClientResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [existingClient, setExistingClient] = useState<ClientResponse | null>(null);

  useEffect(() => {
    loadClients();
    loadRecentClients();
  }, []);

  const loadClients = async () => {
    try {
      const response = await apiGet<ClientsListResponse>('/api/clients?pageSize=100');
      if (response.data) {
        setClients(response.data.items || []);
      }
    } catch (err) {
      console.error('Failed to load clients:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadRecentClients = async () => {
    try {
      const response = await apiGet<ClientsListResponse>('/api/clients?pageSize=5');
      if (response.data) {
        setRecentClients(response.data.items || []);
      }
    } catch (err) {
      console.error('Failed to load recent clients:', err);
    }
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setExistingClient(null);

    if (!newClientName.trim()) {
      setCreateError('Название клиента обязательно');
      return;
    }

    setIsCreating(true);

    try {
      const response = await apiPost<{ client: ClientResponse }>(
        '/api/clients',
        { name: newClientName.trim() }
      );

      if (response.error) {
        // Если ошибка "Client with this name already exists", ищем существующего клиента
        if (response.error.code === 'CLIENT_ALREADY_EXISTS' || 
            response.error.message?.includes('already exists')) {
          const trimmedName = newClientName.trim();
          
          // Сначала проверяем в уже загруженном списке
          let foundClient = clients.find(
            (client) => client.name.toLowerCase() === trimmedName.toLowerCase()
          );
          
          // Если не нашли, загружаем свежий список и ищем там
          if (!foundClient) {
            const refreshedClients = await apiGet<ClientsListResponse>('/api/clients?pageSize=100');
            if (refreshedClients.data) {
              foundClient = refreshedClients.data.items.find(
                (client) => client.name.toLowerCase() === trimmedName.toLowerCase()
              );
              // Обновляем состояние списка клиентов
              if (refreshedClients.data.items) {
                setClients(refreshedClients.data.items);
              }
            }
          }
          
          if (foundClient) {
            setExistingClient(foundClient);
            setCreateError(
              `Клиент с именем "${trimmedName}" уже существует. Вы можете выбрать его ниже.`
            );
          } else {
            setCreateError(response.error.message || 'Клиент с таким именем уже существует');
          }
        } else {
          // Для других ошибок показываем детальное сообщение
          let errorMessage = response.error.message || 'Ошибка создания клиента';
          
          // Если есть детали ошибки, добавляем их для отладки (в dev режиме)
          if (response.error.details && process.env.NODE_ENV === 'development') {
            const detailsStr = JSON.stringify(response.error.details, null, 2);
            errorMessage += `\n\nДетали: ${detailsStr}`;
          }
          
          setCreateError(errorMessage);
          console.error('Client creation error:', response.error);
        }
        setIsCreating(false);
        return;
      }

      if (response.data?.client) {
        // Обновляем списки клиентов
        await loadClients();
        await loadRecentClients();
        
        // Закрываем модальное окно
        setIsCreateModalOpen(false);
        setNewClientName('');
        setCreateError(null);
        setExistingClient(null);
        
        // Привязываем встречу к созданному клиенту и переходим на следующий шаг
        updateFormData({ clientId: response.data.client.id });
        onNext();
      }
    } catch (err) {
      setCreateError('Произошла ошибка при создании клиента');
      setIsCreating(false);
    }
  };

  const handleSelectExistingClient = () => {
    if (existingClient) {
      // Обновляем списки клиентов
      loadClients();
      loadRecentClients();
      
      // Закрываем модальное окно
      setIsCreateModalOpen(false);
      setNewClientName('');
      setCreateError(null);
      setExistingClient(null);
      
      // Привязываем встречу к существующему клиенту и переходим на следующий шаг
      updateFormData({ clientId: existingClient.id });
      onNext();
    }
  };

  const filteredClients = clients.filter((client) =>
    client.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const renderClientButton = (client: ClientResponse) => (
    <button
      key={client.id}
      type="button"
      onClick={() => {
        updateFormData({ clientId: client.id });
        onNext();
      }}
      className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
        formData.clientId === client.id
          ? 'border-blue-600 bg-blue-50'
          : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="font-medium">{client.name}</div>
    </button>
  );

  return (
    <>
      <div className="space-y-4">
        <Input
          placeholder="Поиск клиента..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <div className="space-y-2">
          {searchQuery.trim() === '' ? (
            <>
              {recentClients.length > 0 && (
                <>
                  <div className="text-sm font-medium text-gray-600 mb-2">
                    Последние клиенты
                  </div>
                  {recentClients.map((client) => renderClientButton(client))}
                </>
              )}
              {recentClients.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  Клиенты не найдены
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                className="w-full mt-4"
                onClick={() => setIsCreateModalOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Создать клиента
              </Button>
            </>
          ) : (
            <>
              {filteredClients.map((client) => renderClientButton(client))}
              {filteredClients.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  Клиенты не найдены
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Создать клиента</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => {
                  setIsCreateModalOpen(false);
                  setNewClientName('');
                  setCreateError(null);
                }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateClient} className="space-y-4">
                {createError && (
                  <Alert variant={existingClient ? "default" : "destructive"}>
                    <AlertDescription>{createError}</AlertDescription>
                  </Alert>
                )}

                {existingClient && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="text-sm font-medium text-gray-700 mb-2">
                      Найден существующий клиент:
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-gray-900">{existingClient.name}</div>
                      <Button
                        type="button"
                        onClick={handleSelectExistingClient}
                        className="ml-4"
                      >
                        Выбрать
                      </Button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="clientName">Название клиента</Label>
                  <Input
                    id="clientName"
                    value={newClientName}
                    onChange={(e) => {
                      setNewClientName(e.target.value);
                      setExistingClient(null);
                      setCreateError(null);
                    }}
                    placeholder="Введите название клиента"
                    required
                    disabled={isCreating}
                    autoFocus
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsCreateModalOpen(false);
                      setNewClientName('');
                      setCreateError(null);
                      setExistingClient(null);
                    }}
                    className="flex-1"
                    disabled={isCreating}
                  >
                    Отмена
                  </Button>
                  <Button type="submit" className="flex-1" disabled={isCreating}>
                    {isCreating ? (
                      <>
                        <LoadingSpinner size="sm" className="mr-2" />
                        Создание...
                      </>
                    ) : (
                      'Создать'
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}








