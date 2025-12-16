'use client';

import { Card, CardContent } from '@/components/ui/card';
import { MeetingDetailResponse } from '@/lib/meeting/dto';

interface MeetingHeaderProps {
  meeting: MeetingDetailResponse;
}

export function MeetingHeader({ meeting }: MeetingHeaderProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="text-sm font-medium text-gray-500">Клиент</div>
            <div className="mt-1 text-lg">{meeting.clientName}</div>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-500">Тип встречи</div>
            <div className="mt-1 text-lg">{meeting.meetingTypeName}</div>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-500">Сценарий</div>
            <div className="mt-1 text-lg">{meeting.scenarioName}</div>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-500">Владелец</div>
            <div className="mt-1 text-lg">{meeting.ownerName}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}








