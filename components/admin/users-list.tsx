'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2 } from 'lucide-react';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'ADMIN';
  isActive: boolean;
  createdAt: string;
}

interface UsersListProps {
  users: User[];
  onToggleActive: (userId: string, currentStatus: boolean) => void;
  onUpdate: () => void;
  onEdit: (userId: string) => void;
  onDelete?: (user: User) => void;
}

export function UsersList({ users, onToggleActive, onEdit, onDelete }: UsersListProps) {
  if (users.length === 0) {
    return <p className="text-sm text-gray-500">Пользователи не найдены</p>;
  }

  return (
    <div className="space-y-2">
      {users.map((user) => (
        <div
          key={user.id}
          className="flex items-center justify-between rounded-lg border border-gray-200 p-4"
        >
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">{user.name}</span>
              {user.role === 'ADMIN' && (
                <Badge variant="default">Admin</Badge>
              )}
              {!user.isActive && (
                <Badge variant="secondary">Неактивен</Badge>
              )}
            </div>
            <div className="text-sm text-gray-500">{user.email}</div>
            <div className="text-xs text-gray-400 mt-1">
              Создан: {new Date(user.createdAt).toLocaleDateString('ru')}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(user.id)}
            >
              Редактировать
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onToggleActive(user.id, user.isActive)}
            >
              {user.isActive ? 'Деактивировать' : 'Активировать'}
            </Button>
            {onDelete && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDelete(user)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Удалить
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}








