'use client';

import { MeetingParticipantResponse } from '@/lib/meeting/dto';

interface MeetingParticipantsListProps {
  participants: MeetingParticipantResponse[];
}

export function MeetingParticipantsList({
  participants,
}: MeetingParticipantsListProps) {
  if (participants.length === 0) {
    return <p className="text-sm text-gray-500">Участники не указаны</p>;
  }

  return (
    <div className="space-y-2">
      {participants.map((participant) => (
        <div
          key={participant.participantId}
          className="rounded-lg border border-gray-200 p-3"
        >
          <div className="font-medium">{participant.snapshotFullName}</div>
          {participant.snapshotRoleTitle && (
            <div className="text-sm text-gray-600">
              {participant.snapshotRoleTitle}
            </div>
          )}
          {participant.snapshotCompanyName && (
            <div className="text-sm text-gray-500">
              {participant.snapshotCompanyName}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}








