'use client';

import { useState, useEffect } from 'react';
import { apiGet, apiPost, apiDelete } from '@/lib/api-client';
import { ScenarioResponse } from '@/lib/scenario/dto';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScenariosList } from './scenarios-list';
import { CreateScenarioModal } from './create-scenario-modal';
import { ViewScenarioModal } from './view-scenario-modal';
import { EditScenarioModal } from './edit-scenario-modal';
import { DeleteConfirmModal } from './delete-confirm-modal';
import { Plus } from 'lucide-react';

export function ScenariosManagement() {
  const [scenarios, setScenarios] = useState<ScenarioResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewingScenario, setViewingScenario] = useState<ScenarioResponse | null>(null);
  const [editingScenarioId, setEditingScenarioId] = useState<string | null>(null);
  const [deletingScenario, setDeletingScenario] = useState<ScenarioResponse | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadScenarios();
  }, []);

  const loadScenarios = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiGet<{ items: ScenarioResponse[] }>(
        '/api/scenarios?pageSize=100'
      );
      if (response.error) {
        setError(response.error.message || 'Ошибка загрузки сценариев');
        setIsLoading(false);
        return;
      }

      if (response.data) {
        setScenarios(response.data.items || []);
      }
    } catch (err) {
      setError('Произошла ошибка при загрузке сценариев');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingScenario) return;

    setIsDeleting(true);
    setError(null);

    try {
      const response = await apiDelete<{ success: boolean }>(
        `/api/scenarios/${deletingScenario.id}`
      );

      if (response.error) {
        setError(response.error.message || 'Ошибка удаления сценария');
        setIsDeleting(false);
        return;
      }

      setDeletingScenario(null);
      loadScenarios();
    } catch (err) {
      setError('Произошла ошибка при удалении сценария');
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
          Создать сценарий
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Сценарии</CardTitle>
        </CardHeader>
        <CardContent>
          <ScenariosList
            scenarios={scenarios}
            onUpdate={loadScenarios}
            onView={(scenario) => setViewingScenario(scenario)}
            onEdit={(scenario) => setEditingScenarioId(scenario.id)}
            onDelete={(scenario) => setDeletingScenario(scenario)}
          />
        </CardContent>
      </Card>

      {showCreateModal && (
        <CreateScenarioModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadScenarios();
          }}
        />
      )}

      {viewingScenario && (
        <ViewScenarioModal
          scenario={viewingScenario}
          onClose={() => setViewingScenario(null)}
          onEdit={() => {
            setViewingScenario(null);
            setEditingScenarioId(viewingScenario.id);
          }}
        />
      )}

      {editingScenarioId && (
        <EditScenarioModal
          scenarioId={editingScenarioId}
          onClose={() => setEditingScenarioId(null)}
          onSuccess={() => {
            setEditingScenarioId(null);
            loadScenarios();
          }}
        />
      )}

      {deletingScenario && (
        <DeleteConfirmModal
          isOpen={!!deletingScenario}
          onClose={() => setDeletingScenario(null)}
          onConfirm={handleDelete}
          title="Удалить сценарий?"
          description="Вы уверены, что хотите удалить этот сценарий? Это действие нельзя отменить."
          itemName={deletingScenario.name}
          isLoading={isDeleting}
        />
      )}
    </div>
  );
}


