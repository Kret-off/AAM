'use client';

import { useState, useEffect } from 'react';
import { apiGet } from '@/lib/api-client';
import { MeetingTypeResponse } from '@/lib/scenario/dto';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { CreateMeetingRequest } from '@/lib/meeting/dto';

interface MeetingTypeSelectorProps {
  formData: Partial<CreateMeetingRequest>;
  updateFormData: (data: Partial<CreateMeetingRequest>) => void;
  onNext: () => void;
}

export function MeetingTypeSelector({
  formData,
  updateFormData,
  onNext,
}: MeetingTypeSelectorProps) {
  const [meetingTypes, setMeetingTypes] = useState<MeetingTypeResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadMeetingTypes();
  }, []);

  const loadMeetingTypes = async () => {
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
      setIsLoading(false);
    }
  };

  const filteredTypes = meetingTypes.filter((type) =>
    type.name.toLowerCase().includes(searchQuery.toLowerCase())
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
        placeholder="Поиск типа встречи..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
      <div className="space-y-2">
        {filteredTypes.map((type) => (
          <button
            key={type.id}
            type="button"
            onClick={() => {
              updateFormData({ meetingTypeId: type.id });
              onNext();
            }}
            className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
              formData.meetingTypeId === type.id
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="font-medium">{type.name}</div>
          </button>
        ))}
        {filteredTypes.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            Типы встреч не найдены
          </div>
        )}
      </div>
    </div>
  );
}








