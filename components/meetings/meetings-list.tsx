'use client';

import { useState, useEffect } from 'react';
import { apiGet } from '@/lib/api-client';
import { MeetingResponse, MeetingsListResponse } from '@/lib/meeting/dto';
import { MeetingCard } from './meeting-card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';

export function MeetingsList() {
  const [meetings, setMeetings] = useState<MeetingResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadMeetings();
  }, [page]);

  const loadMeetings = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiGet<MeetingsListResponse>(
        `/api/meetings?page=${page}&pageSize=20`
      );

      if (response.error) {
        setError(response.error.message || 'Ошибка загрузки встреч');
        setIsLoading(false);
        return;
      }

      if (response.data) {
        setMeetings(response.data.items || []);
        setTotalPages(response.data.totalPages || 1);
      }
    } catch (err) {
      setError('Произошла ошибка при загрузке встреч');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (meetings.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-gray-500">Нет встреч</p>
          <p className="mt-2 text-sm text-gray-400">
            Создайте первую встречу, чтобы начать работу
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {meetings.map((meeting) => (
          <MeetingCard key={meeting.id} meeting={meeting} />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Назад
          </button>
          <span className="text-sm text-gray-600">
            Страница {page} из {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Вперед
          </button>
        </div>
      )}
    </div>
  );
}








