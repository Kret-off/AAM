'use client';

import { useState } from 'react';
import { ProtectedRoute } from '@/components/layout/protected-route';
import { Header } from '@/components/layout/header';
import { ClientsList } from '@/components/clients/clients-list';
import { CreateClientModal } from '@/components/clients/create-client-modal';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default function ClientsPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleClientCreated = () => {
    setIsCreateModalOpen(false);
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Клиенты</h1>
              <p className="mt-1 text-sm text-gray-600">
                Управление клиентами и их контекстом
              </p>
            </div>
            <Button onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Новый клиент
            </Button>
          </div>
          <ClientsList key={refreshKey} />
        </main>
        {isCreateModalOpen && (
          <CreateClientModal
            onClose={() => setIsCreateModalOpen(false)}
            onSuccess={handleClientCreated}
          />
        )}
      </div>
    </ProtectedRoute>
  );
}








