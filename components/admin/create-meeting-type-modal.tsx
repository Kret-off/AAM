'use client';

import { useState, useEffect } from 'react';
import { apiGet, apiPost } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { X } from 'lucide-react';

interface CreateMeetingTypeModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface User {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'ADMIN';
}

export function CreateMeetingTypeModal({
  onClose,
  onSuccess,
}: CreateMeetingTypeModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    isActive: true,
    userIds: [] as string[],
  });
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const response = await apiGet<{ items: User[] }>('/api/users?pageSize=100');
      if (response.data) {
        setUsers(response.data.items || []);
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleUserToggle = (userId: string) => {
    setFormData((prev) => ({
      ...prev,
      userIds: prev.userIds.includes(userId)
        ? prev.userIds.filter((id) => id !== userId)
        : [...prev.userIds, userId],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await apiPost<{ meetingType: { id: string } }>(
        '/api/meeting-types',
        formData
      );

      if (response.error) {
        setError(response.error.message || 'Ошибка создания типа встречи');
        setIsSubmitting(false);
        return;
      }

      onSuccess();
    } catch (err) {
      setError('Произошла ошибка при создании типа встречи');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Создать тип встречи</CardTitle>
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

            <div className="space-y-2">
              <Label>Доступ пользователей</Label>
              {isLoadingUsers ? (
                <div className="flex items-center justify-center py-4">
                  <LoadingSpinner size="sm" />
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto border rounded-lg p-2 space-y-2">
                  {users
                    .filter((user) => user.role !== 'ADMIN')
                    .map((user) => (
                      <div key={user.id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`user-${user.id}`}
                          checked={formData.userIds.includes(user.id)}
                          onChange={() => handleUserToggle(user.id)}
                          className="h-4 w-4 rounded border-gray-300"
                          disabled={isSubmitting}
                        />
                        <Label
                          htmlFor={`user-${user.id}`}
                          className="cursor-pointer flex-1 text-sm"
                        >
                          {user.name} ({user.email})
                        </Label>
                      </div>
                    ))}
                  {users.filter((user) => user.role !== 'ADMIN').length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-2">
                      Нет доступных пользователей
                    </p>
                  )}
                </div>
              )}
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
          </form>
        </CardContent>
      </Card>
    </div>
  );
}








