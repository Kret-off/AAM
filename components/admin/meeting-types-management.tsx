'use client';

import { useState, useEffect } from 'react';
import { apiGet, apiPost, apiDelete } from '@/lib/api-client';
import { MeetingTypeResponse, ScenarioResponse } from '@/lib/scenario/dto';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MeetingTypesList } from './meeting-types-list';
import { CreateMeetingTypeModal } from './create-meeting-type-modal';
import { ViewMeetingTypeModal } from './view-meeting-type-modal';
import { EditMeetingTypeModal } from './edit-meeting-type-modal';
import { ViewScenarioModal } from './view-scenario-modal';
import { DeleteConfirmModal } from './delete-confirm-modal';
import { Plus } from 'lucide-react';

export function MeetingTypesManagement() {
  const [meetingTypes, setMeetingTypes] = useState<MeetingTypeResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewingMeetingType, setViewingMeetingType] = useState<MeetingTypeResponse | null>(null);
  const [editingMeetingTypeId, setEditingMeetingTypeId] = useState<string | null>(null);
  const [viewingScenario, setViewingScenario] = useState<ScenarioResponse | null>(null);
  const [deletingMeetingType, setDeletingMeetingType] = useState<MeetingTypeResponse | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadMeetingTypes();
  }, []);

  const loadMeetingTypes = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiGet<{ items: MeetingTypeResponse[] }>(
        '/api/meeting-types?pageSize=100'
      );
      if (response.error) {
        setError(response.error.message || 'Ошибка загрузки типов встреч');
        setIsLoading(false);
        return;
      }

      if (response.data) {
        setMeetingTypes(response.data.items || []);
      }
    } catch (err) {
      setError('Произошла ошибка при загрузке типов встреч');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingMeetingType) return;

    setIsDeleting(true);
    setError(null);

    try {
      const response = await apiDelete<{ success: boolean }>(
        `/api/meeting-types/${deletingMeetingType.id}`
      );

      if (response.error) {
        setError(response.error.message || 'Ошибка удаления типа встречи');
        setIsDeleting(false);
        return;
      }

      setDeletingMeetingType(null);
      loadMeetingTypes();
    } catch (err) {
      setError('Произошла ошибка при удалении типа встречи');
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
          Создать тип встречи
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Типы встреч</CardTitle>
        </CardHeader>
        <CardContent>
          <MeetingTypesList
            meetingTypes={meetingTypes}
            onUpdate={loadMeetingTypes}
            onView={(meetingType) => setViewingMeetingType(meetingType)}
            onEdit={(meetingType) => setEditingMeetingTypeId(meetingType.id)}
            onDelete={(meetingType) => setDeletingMeetingType(meetingType)}
          />
        </CardContent>
      </Card>

      {showCreateModal && (
        <CreateMeetingTypeModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadMeetingTypes();
          }}
        />
      )}

      {viewingMeetingType && (
        <ViewMeetingTypeModal
          meetingType={viewingMeetingType}
          onClose={() => setViewingMeetingType(null)}
          onEdit={() => {
            setViewingMeetingType(null);
            setEditingMeetingTypeId(viewingMeetingType.id);
          }}
          onViewScenario={(scenario) => {
            setViewingMeetingType(null);
            setViewingScenario(scenario);
          }}
        />
      )}

      {editingMeetingTypeId && (
        <EditMeetingTypeModal
          meetingTypeId={editingMeetingTypeId}
          onClose={() => setEditingMeetingTypeId(null)}
          onSuccess={() => {
            setEditingMeetingTypeId(null);
            loadMeetingTypes();
          }}
        />
      )}

      {viewingScenario && (
        <ViewScenarioModal
          scenario={viewingScenario}
          onClose={() => setViewingScenario(null)}
        />
      )}

      {deletingMeetingType && (
        <DeleteConfirmModal
          isOpen={!!deletingMeetingType}
          onClose={() => setDeletingMeetingType(null)}
          onConfirm={handleDelete}
          title="Удалить тип встречи?"
          description="Вы уверены, что хотите удалить этот тип встречи? Это действие нельзя отменить."
          itemName={deletingMeetingType.name}
          isLoading={isDeleting}
        />
      )}
    </div>
  );
}


