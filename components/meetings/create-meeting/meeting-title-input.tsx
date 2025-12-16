'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CreateMeetingRequest } from '@/lib/meeting/dto';

interface MeetingTitleInputProps {
  formData: Partial<CreateMeetingRequest>;
  updateFormData: (data: Partial<CreateMeetingRequest>) => void;
  onNext: () => void;
}

export function MeetingTitleInput({
  formData,
  updateFormData,
}: MeetingTitleInputProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Название встречи (необязательно)</Label>
        <Input
          id="title"
          type="text"
          placeholder="Введите название встречи"
          value={formData.title || ''}
          onChange={(e) => updateFormData({ title: e.target.value })}
          maxLength={255}
        />
        <p className="text-xs text-gray-500">
          Если не указано, будет использовано название по умолчанию
        </p>
      </div>
    </div>
  );
}








