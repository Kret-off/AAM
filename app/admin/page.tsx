'use client';

import { ProtectedRoute } from '@/components/layout/protected-route';
import { Header } from '@/components/layout/header';
import { AdminNav } from '@/components/admin/admin-nav';
import { UsersManagement } from '@/components/admin/users-management';
import { MeetingTypesManagement } from '@/components/admin/meeting-types-management';
import { ScenariosManagement } from '@/components/admin/scenarios-management';
import { useState } from 'react';

type AdminTab = 'users' | 'meeting-types' | 'scenarios';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('users');

  return (
    <ProtectedRoute requireAdmin>
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Админ панель</h1>
            <p className="mt-1 text-sm text-gray-600">
              Управление пользователями, типами встреч и сценариями
            </p>
          </div>

          <AdminNav activeTab={activeTab} onTabChange={setActiveTab} />

          <div className="mt-6">
            {activeTab === 'users' && <UsersManagement />}
            {activeTab === 'meeting-types' && <MeetingTypesManagement />}
            {activeTab === 'scenarios' && <ScenariosManagement />}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}








