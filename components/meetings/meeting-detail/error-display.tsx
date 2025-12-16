'use client';

import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { apiPost } from '@/lib/api-client';
import { format } from 'date-fns';

interface ErrorDisplayProps {
  meetingId: string;
  error?: {
    stage: string;
    code: string;
    message: string;
    details?: Record<string, unknown>;
    occurredAt: string;
  };
  onRetry?: () => void;
  autoRetryCount?: number;
  lastAutoRetryAt?: string | null;
  nextAutoRetryAt?: string | null;
}

export function ErrorDisplay({
  meetingId,
  error,
  onRetry,
  autoRetryCount = 0,
  lastAutoRetryAt,
  nextAutoRetryAt,
}: ErrorDisplayProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  if (!error) {
    return null;
  }

  const handleRetry = async () => {
    setIsRetrying(true);
    setRetryError(null);

    try {
      const response = await apiPost<{ success: boolean }>(
        `/api/meetings/${meetingId}/retry`,
        {}
      );

      if (response.error) {
        setRetryError(response.error.message || 'Ошибка при повторной обработке');
        return;
      }

      // Call onRetry callback to refresh meeting data
      if (onRetry) {
        onRetry();
      }
    } catch (err) {
      setRetryError('Произошла ошибка при повторной обработке');
    } finally {
      setIsRetrying(false);
    }
  };

  // Get stage label in Russian
  const getStageLabel = (stage: string): string => {
    switch (stage) {
      case 'transcription':
        return 'Транскрипция';
      case 'llm':
        return 'Обработка LLM';
      case 'system':
        return 'Системная ошибка';
      default:
        return stage;
    }
  };

  // Get error message based on stage
  const getErrorMessage = () => {
    if (error.message) {
      return error.message;
    }

    switch (error.stage) {
      case 'transcription':
        return 'Ошибка при транскрипции аудио';
      case 'llm':
        return 'Ошибка при обработке LLM';
      case 'system':
        return 'Системная ошибка при обработке';
      default:
        return 'Ошибка обработки';
    }
  };

  // Get error details
  const getErrorDetails = () => {
    if (error.details?.originalError) {
      return String(error.details.originalError);
    }
    return null;
  };

  const errorDetails = getErrorDetails();

  return (
    <Alert variant="destructive">
      <AlertTitle>Ошибка обработки</AlertTitle>
      <AlertDescription className="space-y-4">
        <div>
          <p className="text-sm font-medium text-gray-600 mb-1">
            Этап: {getStageLabel(error.stage)}
          </p>
          <p className="font-medium">{getErrorMessage()}</p>
          {errorDetails && (
            <p className="mt-2 text-sm opacity-90">{errorDetails}</p>
          )}
          {error.occurredAt && (
            <p className="mt-2 text-xs opacity-75">
              Время ошибки:{' '}
              {format(new Date(error.occurredAt), 'dd MMM yyyy, HH:mm')}
            </p>
          )}
        </div>

        {autoRetryCount > 0 && (
          <div className="rounded-md bg-blue-50 border border-blue-200 p-3">
            <p className="text-sm font-medium text-blue-900 mb-1">
              Автоматическая повторная обработка
            </p>
            <p className="text-xs text-blue-700">
              Попытка {autoRetryCount} из 3
            </p>
            {nextAutoRetryAt && (
              <p className="text-xs text-blue-600 mt-1">
                Следующая попытка:{' '}
                {format(new Date(nextAutoRetryAt), 'dd MMM yyyy, HH:mm')}
              </p>
            )}
            {lastAutoRetryAt && !nextAutoRetryAt && (
              <p className="text-xs text-blue-600 mt-1">
                Последняя попытка:{' '}
                {format(new Date(lastAutoRetryAt), 'dd MMM yyyy, HH:mm')}
              </p>
            )}
          </div>
        )}

        {retryError && (
          <div className="rounded-md bg-red-100 p-2 text-sm text-red-800">
            {retryError}
          </div>
        )}

        <Button
          onClick={handleRetry}
          disabled={isRetrying}
          variant="outline"
          size="sm"
          className="mt-2"
        >
          {isRetrying ? (
            <>
              <svg
                className="mr-2 h-4 w-4 animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Обработка...
            </>
          ) : (
            <>
              <svg
                className="mr-2 h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Повторить обработку
            </>
          )}
        </Button>
      </AlertDescription>
    </Alert>
  );
}

