'use client';

import { ProtectedRoute } from '@/components/layout/protected-route';
import { Header } from '@/components/layout/header';
import { MeetingDetail } from '@/components/meetings/meeting-detail';
import { use } from 'react';

export default function MeetingDetailPage({
  params,
}: {
  params: Promise<{ meetingId: string }>;
}) {
  const { meetingId } = use(params);

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <MeetingDetail meetingId={meetingId} />
        </main>
      </div>
    </ProtectedRoute>
  );
}








