'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/badge';
import { MeetingResponse } from '@/lib/meeting/dto';
import { format } from 'date-fns';
import { AlertCircle } from 'lucide-react';

interface MeetingCardProps {
  meeting: MeetingResponse;
}

export function MeetingCard({ meeting }: MeetingCardProps) {
  const hasError =
    meeting.status === 'Failed_Transcription' ||
    meeting.status === 'Failed_LLM' ||
    meeting.status === 'Failed_System';

  return (
    <Link href={`/meetings/${meeting.id}`}>
      <Card className="transition-shadow hover:shadow-md">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-2 flex-1">
              <CardTitle className="text-lg line-clamp-2 flex-1">
                {meeting.title || `${meeting.meetingTypeName} - ${meeting.clientName}`}
              </CardTitle>
              {hasError && (
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              )}
            </div>
            <StatusBadge status={meeting.status} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-gray-600">
            <div>
              <span className="font-medium">Клиент:</span> {meeting.clientName}
            </div>
            <div>
              <span className="font-medium">Тип:</span> {meeting.meetingTypeName}
            </div>
            <div>
              <span className="font-medium">Владелец:</span> {meeting.ownerName}
            </div>
            <div>
              <span className="font-medium">Создано:</span>{' '}
              {format(new Date(meeting.createdAt), 'dd MMM yyyy, HH:mm')}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

