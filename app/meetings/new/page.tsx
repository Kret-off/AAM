'use client';

import { ProtectedRoute } from '@/components/layout/protected-route';
import { Header } from '@/components/layout/header';
import { CreateMeetingForm } from '@/components/meetings/create-meeting-form';

export default function NewMeetingPage() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Новая встреча</h1>
            <p className="mt-1 text-sm text-gray-600">
              Создайте новую встречу и загрузите запись
            </p>
          </div>
          <CreateMeetingForm />
        </main>
      </div>
    </ProtectedRoute>
  );
}








