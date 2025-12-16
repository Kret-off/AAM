'use client';

import { useState } from 'react';
import { MeetingViewerResponse } from '@/lib/meeting/dto';
import { Button } from '@/components/ui/button';
import { apiGet, apiDelete } from '@/lib/api-client';
import { AddViewerModal } from './add-viewer-modal';
import { TransferOwnershipModal } from './transfer-ownership-modal';
import { UserPlus, UserX, UserCog } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

interface MeetingViewersListProps {
  meetingId: string;
  viewers: MeetingViewerResponse[];
  onUpdate: () => void;
}

export function MeetingViewersList({
  meetingId,
  viewers,
  onUpdate,
}: MeetingViewersListProps) {
  const { user } = useAuth();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);

  const handleRemoveViewer = async (userId: string) => {
    try {
      const response = await apiDelete<{ success: boolean }>(
        `/api/meetings/${meetingId}/viewers?userId=${userId}`
      );

      if (response.error) {
        alert(response.error.message || 'Ошибка удаления');
        return;
      }

      onUpdate();
    } catch (err) {
      alert('Произошла ошибка при удалении');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAddModal(true)}
        >
          <UserPlus className="mr-2 h-4 w-4" />
          Добавить
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowTransferModal(true)}
        >
          <UserCog className="mr-2 h-4 w-4" />
          Передать владение
        </Button>
      </div>

      {viewers.length === 0 ? (
        <p className="text-sm text-gray-500">Нет просматривающих</p>
      ) : (
        <div className="space-y-2">
          {viewers.map((viewer) => (
            <div
              key={viewer.userId}
              className="flex items-center justify-between rounded-lg border border-gray-200 p-3"
            >
              <div>
                <div className="font-medium">{viewer.userName}</div>
                <div className="text-xs text-gray-500">
                  Добавлен: {new Date(viewer.addedAt).toLocaleDateString('ru')}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveViewer(viewer.userId)}
              >
                <UserX className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <AddViewerModal
          meetingId={meetingId}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            onUpdate();
          }}
        />
      )}

      {showTransferModal && (
        <TransferOwnershipModal
          meetingId={meetingId}
          onClose={() => setShowTransferModal(false)}
          onSuccess={() => {
            setShowTransferModal(false);
            onUpdate();
          }}
        />
      )}
    </div>
  );
}








