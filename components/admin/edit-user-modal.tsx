'use client';

import { useState, useEffect } from 'react';
import { apiGet, apiPatch } from '@/lib/api-client';
import { MeetingTypeResponse } from '@/lib/scenario/dto';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { X } from 'lucide-react';

interface EditUserModalProps {
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface UserData {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  role: 'USER' | 'ADMIN';
  isActive: boolean;
  createdAt: string;
  availableMeetingTypes: Array<{
    id: string;
    name: string;
    isActive: boolean;
  }>;
}

export function EditUserModal({
  userId,
  onClose,
  onSuccess,
}: EditUserModalProps) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    password: '',
    meetingTypeIds: [] as string[],
  });
  const [meetingTypes, setMeetingTypes] = useState<MeetingTypeResponse[]>([]);
  const [isLoadingTypes, setIsLoadingTypes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadMeetingTypes();
    loadUser();
  }, [userId]);

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

  const loadUser = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiGet<UserData>(`/api/users/${userId}`);

      if (response.error) {
        console.error('Error loading user:', response.error);
        setError(response.error.message || 'Ошибка загрузки пользователя');
        setIsLoading(false);
        return;
      }

      if (response.data) {
        console.log('User data loaded:', response.data);
        setFormData({
          firstName: response.data.firstName || '',
          lastName: response.data.lastName || '',
          password: '',
          meetingTypeIds: response.data.availableMeetingTypes?.map((mt) => mt.id) || [],
        });
      } else {
        console.error('No data in response:', response);
        setError('Данные пользователя не получены');
      }
    } catch (err) {
      console.error('Exception loading user:', err);
      setError('Произошла ошибка при загрузке пользователя');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.firstName.trim()) {
      setError('Имя обязательно для заполнения');
      return;
    }

    setIsSubmitting(true);

    try {
      const updateData: {
        firstName: string;
        lastName: string;
        password?: string;
        meetingTypeIds: string[];
      } = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        meetingTypeIds: formData.meetingTypeIds,
      };

      // Only include password if it's provided
      if (formData.password.trim()) {
        if (formData.password.length < 8) {
          setError('Пароль должен содержать минимум 8 символов');
          setIsSubmitting(false);
          return;
        }
        updateData.password = formData.password;
      }

      const response = await apiPatch<UserData>(`/api/users/${userId}`, updateData);

      if (response.error) {
        setError(response.error.message || 'Ошибка обновления пользователя');
        setIsSubmitting(false);
        return;
      }

      onSuccess();
    } catch (err) {
      setError('Произошла ошибка при обновлении пользователя');
      setIsSubmitting(false);
    }
  };

  const handleMeetingTypeToggle = (meetingTypeId: string) => {
    setFormData((prev) => ({
      ...prev,
      meetingTypeIds: prev.meetingTypeIds.includes(meetingTypeId)
        ? prev.meetingTypeIds.filter((id) => id !== meetingTypeId)
        : [...prev.meetingTypeIds, meetingTypeId],
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col">
        <CardHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle>Редактировать пользователя</CardTitle>
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Имя</Label>
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) =>
                        setFormData({ ...formData, firstName: e.target.value })
                      }
                      required
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lastName">Фамилия</Label>
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) =>
                        setFormData({ ...formData, lastName: e.target.value })
                      }
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Новый пароль</Label>
                      <Input
                        id="password"
                        type="password"
                        value={formData.password}
                        onChange={(e) =>
                          setFormData({ ...formData, password: e.target.value })
                        }
                        disabled={isSubmitting}
                        minLength={8}
                        placeholder="Оставьте пустым, чтобы не менять пароль"
                      />
                  <p className="text-xs text-gray-500">
                    Оставьте пустым, чтобы не изменять пароль. Минимум 8 символов.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Доступные типы встреч</Label>
                  {isLoadingTypes ? (
                    <div className="flex items-center justify-center py-2">
                      <LoadingSpinner size="sm" />
                    </div>
                  ) : (
                    <div className="max-h-48 overflow-y-auto border rounded-md p-3 space-y-2">
                      {meetingTypes
                        .filter((type) => type.isActive)
                        .map((type) => (
                          <div key={type.id} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={`meeting-type-${type.id}`}
                              checked={formData.meetingTypeIds.includes(type.id)}
                              onChange={() => handleMeetingTypeToggle(type.id)}
                              className="h-4 w-4 rounded border-gray-300"
                              disabled={isSubmitting}
                            />
                            <Label
                              htmlFor={`meeting-type-${type.id}`}
                              className="cursor-pointer flex-1"
                            >
                              {type.name}
                            </Label>
                          </div>
                        ))}
                      {meetingTypes.filter((type) => type.isActive).length === 0 && (
                        <p className="text-sm text-gray-500">Нет доступных типов встреч</p>
                      )}
                    </div>
                  )}
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




