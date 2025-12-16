'use client';

import { MeetingTypeResponse } from '@/lib/scenario/dto';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, Edit, Trash2 } from 'lucide-react';

interface MeetingTypesListProps {
  meetingTypes: MeetingTypeResponse[];
  onUpdate: () => void;
  onView?: (meetingType: MeetingTypeResponse) => void;
  onEdit?: (meetingType: MeetingTypeResponse) => void;
  onDelete?: (meetingType: MeetingTypeResponse) => void;
}

export function MeetingTypesList({
  meetingTypes,
  onView,
  onEdit,
  onDelete,
}: MeetingTypesListProps) {
  if (meetingTypes.length === 0) {
    return <p className="text-sm text-gray-500">Типы встреч не найдены</p>;
  }

  return (
    <div className="space-y-2">
      {meetingTypes.map((type) => (
        <div
          key={type.id}
          className="flex items-center justify-between rounded-lg border border-gray-200 p-4"
        >
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{type.name}</span>
              {!type.isActive && (
                <Badge variant="secondary">Неактивен</Badge>
              )}
            </div>
            {type.scenariosCount !== undefined && (
              <div className="text-sm text-gray-500 mt-1">
                {type.scenariosCount} сценариев
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {onView && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onView(type)}
              >
                <Eye className="mr-2 h-4 w-4" />
                Просмотр
              </Button>
            )}
            {onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(type)}
              >
                <Edit className="mr-2 h-4 w-4" />
                Редактировать
              </Button>
            )}
            {onDelete && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDelete(type)}
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


