'use client';

import { MeetingStatus } from '@prisma/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface ProcessingStatusProps {
  status: MeetingStatus;
  hasTranscript: boolean;
  hasArtifacts: boolean;
}

type StageStatus = 'completed' | 'in_progress' | 'pending';

interface Stage {
  name: string;
  status: StageStatus;
}

export function ProcessingStatus({
  status,
  hasTranscript,
  hasArtifacts,
}: ProcessingStatusProps) {
  // Debug logging
  console.log('[ProcessingStatus] Props:', { status, hasTranscript, hasArtifacts });

  // Не показывать для финальных статусов и ошибок
  if (
    status === 'Validated' ||
    status === 'Rejected' ||
    status === 'Failed_Transcription' ||
    status === 'Failed_LLM' ||
    status === 'Failed_System'
  ) {
    return null;
  }

  // Расчет процента прогресса
  const calculateProgress = (): number => {
    if (status === 'Uploaded') {
      return 0;
    }
    if (status === 'Transcribing') {
      return hasTranscript ? 66 : 33;
    }
    if (status === 'LLM_Processing') {
      if (hasArtifacts) {
        return 100;
      }
      return hasTranscript ? 66 : 33;
    }
    if (status === 'Ready') {
      return 100;
    }
    return 0;
  };

  // Определение статусов этапов
  const getStages = (): Stage[] => {
    const transcriptionStage: Stage = {
      name: 'Транскрипция',
      status: 'pending',
    };
    const llmStage: Stage = {
      name: 'Обработка LLM',
      status: 'pending',
    };

    if (status === 'Transcribing') {
      transcriptionStage.status = hasTranscript ? 'completed' : 'in_progress';
    } else if (status === 'LLM_Processing' || status === 'Ready') {
      transcriptionStage.status = 'completed';
      llmStage.status = hasArtifacts ? 'completed' : 'in_progress';
    }

    return [transcriptionStage, llmStage];
  };

  const progress = calculateProgress();
  const stages = getStages();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Прогресс обработки</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Общий прогресс</span>
            <span className="font-medium text-gray-900">{progress}%</span>
          </div>
          <Progress value={progress} />
        </div>

        <div className="space-y-3">
          <div className="text-sm font-medium text-gray-700">Этапы обработки:</div>
          {stages.map((stage, index) => (
            <div key={index} className="flex items-center gap-3">
              {stage.status === 'completed' && (
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500">
                  <svg
                    className="h-3 w-3 text-white"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="3"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
              {stage.status === 'in_progress' && (
                <div className="flex h-5 w-5 items-center justify-center">
                  <div className="h-3 w-3 animate-pulse rounded-full bg-blue-600" />
                </div>
              )}
              {stage.status === 'pending' && (
                <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-gray-300 bg-white" />
              )}
              <span
                className={cn('text-sm', {
                  'font-medium text-green-700': stage.status === 'completed',
                  'font-medium text-blue-700': stage.status === 'in_progress',
                  'text-gray-500': stage.status === 'pending',
                })}
              >
                {stage.name}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

