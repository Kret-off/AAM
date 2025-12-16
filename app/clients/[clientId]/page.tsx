'use client';

import { ProtectedRoute } from '@/components/layout/protected-route';
import { Header } from '@/components/layout/header';
import { ClientDetail } from '@/components/clients/client-detail';
import { use } from 'react';

export default function ClientDetailPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = use(params);

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <ClientDetail clientId={clientId} />
        </main>
      </div>
    </ProtectedRoute>
  );
}








