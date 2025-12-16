'use client';

import { useState, useEffect } from 'react';
import { apiGet } from '@/lib/api-client';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface TranscriptViewerProps {
  meetingId: string;
}

export function TranscriptViewer({ meetingId }: TranscriptViewerProps) {
  const [transcript, setTranscript] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTranscript();
  }, [meetingId]);

  const loadTranscript = async () => {
    try {
      const response = await apiGet<{ transcript: string }>(
        `/api/meetings/${meetingId}/transcript`
      );

      if (response.error) {
        console.error('Transcript API error:', response.error);
        return;
      }

      if (response.data) {
        setTranscript(response.data.transcript);
      } else {
        console.warn('Transcript API returned no data');
      }
    } catch (err) {
      console.error('Failed to load transcript:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!transcript) {
    return <p className="text-sm text-gray-500">Транскрипция не найдена</p>;
  }

  return (
    <div className="whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm">
      {transcript}
    </div>
  );
}

