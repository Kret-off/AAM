'use client';

import { useState, useEffect } from 'react';
import { apiGet } from '@/lib/api-client';
import { ScenarioResponse } from '@/lib/scenario/dto';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { CreateMeetingRequest } from '@/lib/meeting/dto';

interface ScenarioSelectorProps {
  formData: Partial<CreateMeetingRequest>;
  updateFormData: (data: Partial<CreateMeetingRequest>) => void;
  onNext: () => void;
}

export function ScenarioSelector({
  formData,
  updateFormData,
  onNext,
}: ScenarioSelectorProps) {
  const [scenarios, setScenarios] = useState<ScenarioResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (formData.meetingTypeId) {
      loadScenarios();
    } else {
      setScenarios([]);
      setIsLoading(false);
    }
  }, [formData.meetingTypeId]);

  // Validate that selected scenario belongs to the current meeting type
  useEffect(() => {
    if (formData.scenarioId && scenarios.length > 0) {
      const scenarioExists = scenarios.some(s => s.id === formData.scenarioId);
      if (!scenarioExists) {
        // Scenario doesn't match the current meeting type, reset it
        updateFormData({ scenarioId: undefined });
      }
    }
  }, [scenarios, formData.scenarioId]);

  const loadScenarios = async () => {
    setIsLoading(true);
    try {
      const response = await apiGet<{ items: ScenarioResponse[] }>(
        `/api/scenarios?meetingTypeId=${formData.meetingTypeId}&pageSize=100`
      );
      if (response.data) {
        setScenarios(response.data.items || []);
      }
    } catch (err) {
      console.error('Failed to load scenarios:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredScenarios = scenarios.filter((scenario) =>
    scenario.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!formData.meetingTypeId) {
    return (
      <div className="text-center py-8 text-gray-500">
        Сначала выберите тип встречи
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Input
        placeholder="Поиск сценария..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
      <div className="space-y-2">
        {filteredScenarios.map((scenario) => (
          <button
            key={scenario.id}
            type="button"
            onClick={() => {
              updateFormData({ scenarioId: scenario.id });
              onNext();
            }}
            className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
              formData.scenarioId === scenario.id
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="font-medium">{scenario.name}</div>
            <div className="text-sm text-gray-500 mt-1">
              {scenario.meetingTypeName}
            </div>
          </button>
        ))}
        {filteredScenarios.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            Сценарии не найдены
          </div>
        )}
      </div>
    </div>
  );
}


