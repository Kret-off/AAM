'use client';

import { useState, useEffect } from 'react';
import { apiGet } from '@/lib/api-client';
import { ParticipantResponse, ParticipantsListResponse } from '@/lib/directory/dto';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { CreateMeetingRequest } from '@/lib/meeting/dto';
import { Check } from 'lucide-react';

interface ParticipantsSelectorProps {
  formData: Partial<CreateMeetingRequest>;
  updateFormData: (data: Partial<CreateMeetingRequest>) => void;
  onNext: () => void;
}

export function ParticipantsSelector({
  formData,
  updateFormData,
  onNext,
}: ParticipantsSelectorProps) {
  const [participants, setParticipants] = useState<ParticipantResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const selectedIds = formData.participantIds || [];

  useEffect(() => {
    loadParticipants();
  }, []);

  const loadParticipants = async () => {
    try {
      const response = await apiGet<ParticipantsListResponse>(
        '/api/participants?pageSize=100'
      );
      if (response.data) {
        setParticipants(response.data.items || []);
      }
    } catch (err) {
      console.error('Failed to load participants:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleParticipant = (participantId: string) => {
    const currentIds = selectedIds;
    const newIds = currentIds.includes(participantId)
      ? currentIds.filter((id) => id !== participantId)
      : [...currentIds, participantId];
    updateFormData({ participantIds: newIds });
  };

  const filteredParticipants = participants.filter((participant) =>
    participant.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Input
        placeholder="Поиск участника..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
      <div className="space-y-2">
        {filteredParticipants.map((participant) => {
          const isSelected = selectedIds.includes(participant.id);
          return (
            <button
              key={participant.id}
              type="button"
              onClick={() => toggleParticipant(participant.id)}
              className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                isSelected
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{participant.fullName}</div>
                  {participant.roleTitle && (
                    <div className="text-sm text-gray-500">
                      {participant.roleTitle}
                    </div>
                  )}
                </div>
                {isSelected && (
                  <Check className="h-5 w-5 text-blue-600" />
                )}
              </div>
            </button>
          );
        })}
        {filteredParticipants.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            Участники не найдены
          </div>
        )}
      </div>
      {selectedIds.length > 0 && (
        <div className="text-sm text-gray-600">
          Выбрано: {selectedIds.length}
        </div>
      )}
    </div>
  );
}








