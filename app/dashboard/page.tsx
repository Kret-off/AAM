'use client';

import { ProtectedRoute } from '@/components/layout/protected-route';
import { Header } from '@/components/layout/header';
import { MeetingsList } from '@/components/meetings/meetings-list';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus } from 'lucide-react';

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Встречи</h1>
              <p className="mt-1 text-sm text-gray-600">
                Управление встречами и их результатами
              </p>
            </div>
            <Link href="/meetings/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Новая встреча
              </Button>
            </Link>
          </div>
          <MeetingsList />
        </main>
      </div>
    </ProtectedRoute>
  );
}








