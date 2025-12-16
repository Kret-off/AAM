'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { format, isToday, isYesterday } from 'date-fns';
import { ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';

interface ErrorHistoryProps {
  errors: Array<{
    id: string;
    stage: string;
    code: string;
    message: string;
    details?: Record<string, unknown>;
    occurredAt: string;
  }>;
}

type GroupedErrors = {
  dateLabel: string;
  errors: ErrorHistoryProps['errors'];
};

export function ErrorHistory({ errors }: ErrorHistoryProps) {
  const [expandedDetails, setExpandedDetails] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  if (!errors || errors.length === 0) {
    return null;
  }

  // Получить русское название этапа
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

  // Берем последние 3 ошибки по умолчанию (ошибки уже отсортированы по дате DESC)
  const errorsToDisplay = showAll ? errors : errors.slice(0, 3);
  
  // Группируем только те ошибки, которые нужно показать
  const groupErrorsToDisplay = (): GroupedErrors[] => {
    const groups: Record<string, ErrorHistoryProps['errors']> = {};

    errorsToDisplay.forEach((error) => {
      const date = new Date(error.occurredAt);
      let dateLabel: string;

      if (isToday(date)) {
        dateLabel = 'Сегодня';
      } else if (isYesterday(date)) {
        dateLabel = 'Вчера';
      } else {
        dateLabel = format(date, 'dd.MM.yyyy');
      }

      if (!groups[dateLabel]) {
        groups[dateLabel] = [];
      }
      groups[dateLabel].push(error);
    });

    return Object.entries(groups).map(([dateLabel, errors]) => ({
      dateLabel,
      errors,
    }));
  };

  const groupedErrors = groupErrorsToDisplay();

  const toggleDetails = (errorId: string) => {
    const newExpanded = new Set(expandedDetails);
    if (newExpanded.has(errorId)) {
      newExpanded.delete(errorId);
    } else {
      newExpanded.add(errorId);
    }
    setExpandedDetails(newExpanded);
  };

  const hasMoreErrors = errors.length > 3;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-600" />
          История ошибок
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {groupedErrors.map((group) => {
          return (
            <div key={group.dateLabel} className="space-y-3">
              <div className="text-sm font-medium text-gray-700">
                {group.dateLabel}
              </div>
              {group.errors.map((error) => {
                const isExpanded = expandedDetails.has(error.id);
                const errorDate = new Date(error.occurredAt);

                return (
                  <Alert key={error.id} variant="destructive">
                    <AlertDescription className="space-y-2">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded">
                                {getStageLabel(error.stage)}
                              </span>
                              <span className="text-xs text-gray-600">
                                {format(errorDate, 'HH:mm')}
                              </span>
                            </div>
                            <p className="font-medium text-sm">{error.message}</p>
                            <p className="text-xs text-gray-600 mt-1">
                              Код: {error.code}
                            </p>
                          </div>
                        </div>

                        {error.details && Object.keys(error.details).length > 0 && (
                          <div className="mt-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleDetails(error.id)}
                              className="h-6 px-2 text-xs"
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronUp className="h-3 w-3 mr-1" />
                                  Скрыть детали
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="h-3 w-3 mr-1" />
                                  Показать детали
                                </>
                              )}
                            </Button>
                            {isExpanded && (
                              <div className="mt-2 rounded-md bg-red-50 p-2 text-xs">
                                <pre className="whitespace-pre-wrap break-words text-gray-800">
                                  {JSON.stringify(error.details, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </AlertDescription>
                  </Alert>
                );
              })}
            </div>
          );
        })}

        {hasMoreErrors && !showAll && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAll(true)}
            className="w-full"
          >
            Показать все ошибки ({errors.length})
          </Button>
        )}

        {showAll && hasMoreErrors && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAll(false)}
            className="w-full"
          >
            Скрыть
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

