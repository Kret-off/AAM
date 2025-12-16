'use client';

import { useState, useEffect } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { UsersList } from './users-list';
import { CreateUserModal } from './create-user-modal';
import { EditUserModal } from './edit-user-modal';
import { DeleteConfirmModal } from './delete-confirm-modal';
import { Plus } from 'lucide-react';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'ADMIN';
  isActive: boolean;
  createdAt: string;
}

export function UsersManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiGet<{ items: User[] }>('/api/users?pageSize=100');
      if (response.error) {
        setError(response.error.message || 'Ошибка загрузки пользователей');
        setIsLoading(false);
        return;
      }

      if (response.data) {
        setUsers(response.data.items || []);
      }
    } catch (err) {
      setError('Произошла ошибка при загрузке пользователей');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleActive = async (userId: string, currentStatus: boolean) => {
    try {
      const response = await apiPut<{ success: boolean }>(
        `/api/users/${userId}`,
        { isActive: !currentStatus }
      );

      if (response.error) {
        alert(response.error.message || 'Ошибка обновления');
        return;
      }

      loadUsers();
    } catch (err) {
      alert('Произошла ошибка');
    }
  };

  const handleDelete = async () => {
    if (!deletingUser) return;

    setIsDeleting(true);
    setError(null);

    try {
      const response = await apiDelete<{ success: boolean }>(
        `/api/users/${deletingUser.id}`
      );

      if (response.error) {
        setError(response.error.message || 'Ошибка удаления пользователя');
        setIsDeleting(false);
        return;
      }

      setDeletingUser(null);
      loadUsers();
    } catch (err) {
      setError('Произошла ошибка при удалении пользователя');
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Создать пользователя
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Пользователи</CardTitle>
        </CardHeader>
        <CardContent>
          <UsersList
            users={users}
            onToggleActive={handleToggleActive}
            onUpdate={loadUsers}
            onEdit={setEditingUserId}
            onDelete={(user) => setDeletingUser(user)}
          />
        </CardContent>
      </Card>

      {showCreateModal && (
        <CreateUserModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadUsers();
          }}
        />
      )}

      {editingUserId && (
        <EditUserModal
          userId={editingUserId}
          onClose={() => setEditingUserId(null)}
          onSuccess={() => {
            setEditingUserId(null);
            loadUsers();
          }}
        />
      )}

      {deletingUser && (
        <DeleteConfirmModal
          isOpen={!!deletingUser}
          onClose={() => setDeletingUser(null)}
          onConfirm={handleDelete}
          title="Удалить пользователя?"
          description="Вы уверены, что хотите удалить этого пользователя? Это действие нельзя отменить."
          itemName={deletingUser.name}
          isLoading={isDeleting}
        />
      )}
    </div>
  );
}








