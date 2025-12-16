'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ClientResponse } from '@/lib/client-kb/dto';
import { format } from 'date-fns';

interface ClientCardProps {
  client: ClientResponse;
}

export function ClientCard({ client }: ClientCardProps) {
  return (
    <Link href={`/clients/${client.id}`}>
      <Card className="transition-shadow hover:shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">{client.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-gray-600">
            <div>
              <span className="font-medium">Создано:</span>{' '}
              {format(new Date(client.createdAt), 'dd MMM yyyy')}
            </div>
            {client.contextSummary && (
              <div className="mt-2 line-clamp-2 text-xs text-gray-500">
                {client.contextSummary.substring(0, 100)}...
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}








