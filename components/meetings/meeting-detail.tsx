'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet, apiPost, apiDelete } from '@/lib/api-client';
import { MeetingDetailResponse, ValidateMeetingRequest } from '@/lib/meeting/dto';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MeetingHeader } from './meeting-detail/meeting-header';
import { MeetingParticipantsList } from './meeting-detail/meeting-participants-list';
import { MeetingViewersList } from './meeting-detail/meeting-viewers-list';
import { ArtifactsViewer } from './meeting-detail/artifacts-viewer';
import { TranscriptViewer } from './meeting-detail/transcript-viewer';
import { ValidationActions } from './meeting-detail/validation-actions';
import { ErrorDisplay } from './meeting-detail/error-display';
import { ProcessingStatus } from './meeting-detail/processing-status';
import { ErrorHistory } from './meeting-detail/error-history';
import { useAuth } from '@/hooks/use-auth';
import { useMeetingEvents } from '@/hooks/use-meeting-events';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { MeetingStatusUpdateEvent } from '@/lib/realtime/pubsub';

interface MeetingDetailProps {
  meetingId: string;
}

export function MeetingDetail({ meetingId }: MeetingDetailProps) {
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const [meeting, setMeeting] = useState<MeetingDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTranscriptExpanded, setIsTranscriptExpanded] = useState(false);
  const hasShownErrorToast = useRef(false);

  // Handle status updates from SSE
  const handleStatusUpdate = (event: MeetingStatusUpdateEvent) => {
    if (!meeting) return;

    // Reload full meeting data when status changes
    // This ensures we get all updated fields (error history, validation, etc.)
    const previousStatus = meeting.status;
    const newStatus = event.status;

    // Only reload if status actually changed
    if (previousStatus !== newStatus) {
      console.log(`[MeetingDetail] Status changed from ${previousStatus} to ${newStatus}, reloading meeting data`);
      // Silent reload - don't show loading spinner for SSE updates
      loadMeeting(true);
    } else {
      // Status didn't change, but data might have (hasTranscript, hasArtifacts)
      // Update those fields without full reload
      setMeeting((prevMeeting) => {
        if (!prevMeeting) return prevMeeting;
        return {
          ...prevMeeting,
          hasTranscript: event.data?.hasTranscript ?? prevMeeting.hasTranscript,
          hasArtifacts: event.data?.hasArtifacts ?? prevMeeting.hasArtifacts,
        };
      });
    }
  };

  // Subscribe to meeting status updates via SSE
  useMeetingEvents(meetingId, {
    onStatusUpdate: handleStatusUpdate,
    onError: (error) => {
      console.error('[MeetingDetail] SSE connection error:', error);
      // Don't show toast for connection errors - they're handled by auto-reconnect
    },
  });

  useEffect(() => {
    loadMeeting();
  }, [meetingId]);

  const loadMeeting = async (silent = false) => {
    if (!silent) {
      setIsLoading(true);
    }
    setError(null);

    try {
      const response = await apiGet<MeetingDetailResponse>(
        `/api/meetings/${meetingId}`
      );

      if (response.error) {
        console.error('[MeetingDetail] API error:', response.error);
        setError(response.error.message || 'Ошибка загрузки встречи');
        setIsLoading(false);
        return;
      }

      if (response.data) {
        console.log('[MeetingDetail] Loaded meeting data:', {
          id: response.data.id,
          status: response.data.status,
          hasTranscript: response.data.hasTranscript,
          hasArtifacts: response.data.hasArtifacts,
        });
        
        // Debug: Log if transcript should be shown
        if (!response.data.hasTranscript && response.data.status !== 'Uploaded') {
          console.warn('[MeetingDetail] Transcript missing but status is:', response.data.status);
        }
        
        setMeeting(response.data);

        // Show toast if meeting has failed status and user just opened the page
        if (
          response.data.status &&
          (response.data.status === 'Failed_Transcription' ||
            response.data.status === 'Failed_LLM' ||
            response.data.status === 'Failed_System') &&
          response.data.latestError &&
          !hasShownErrorToast.current
        ) {
          hasShownErrorToast.current = true;

          const errorTypeLabels: Record<string, string> = {
            transcription: 'Транскрипция',
            llm: 'Обработка LLM',
            system: 'Системная ошибка',
          };

          toast.error('Ошибка обработки встречи', {
            description: `${response.data.title || 'Встреча'} - ${
              errorTypeLabels[response.data.latestError.stage] || response.data.latestError.stage
            }`,
            duration: 10000,
            action: {
              label: 'Перейти',
              onClick: () => {
                // Already on the page, just scroll to error
                window.scrollTo({ top: 0, behavior: 'smooth' });
              },
            },
          });
        }
      }
    } catch (err) {
      setError('Произошла ошибка при загрузке встречи');
    } finally {
      setIsLoading(false);
    }
  };

  const handleValidate = async (decision: 'accepted' | 'rejected', rejectionReason?: string) => {
    if (!meeting) return;

    try {
      const request: ValidateMeetingRequest = { decision };
      if (decision === 'rejected' && rejectionReason) {
        request.rejectionReason = rejectionReason;
      }

      const response = await apiPost<{ success: boolean }>(
        `/api/meetings/${meetingId}/validate`,
        request
      );

      if (response.error) {
        setError(response.error.message || 'Ошибка валидации');
        return;
      }

      // Reload meeting data
      loadMeeting();
    } catch (err) {
      setError('Произошла ошибка при валидации');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error || 'Встреча не найдена'}</AlertDescription>
      </Alert>
    );
  }

  const isOwner = user?.id === meeting.ownerUserId;
  const canValidate = isOwner && meeting.status === 'Ready';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {meeting.title || `${meeting.meetingTypeName} - ${meeting.clientName}`}
          </h1>
          <div className="mt-2 flex items-center gap-4">
            <StatusBadge status={meeting.status} />
            <span className="text-sm text-gray-600">
              Создано: {format(new Date(meeting.createdAt), 'dd MMM yyyy, HH:mm')}
            </span>
          </div>
        </div>
        <Button variant="outline" onClick={() => router.back()}>
          Назад
        </Button>
      </div>

      <MeetingHeader meeting={meeting} />

      {(meeting.status === 'Failed_Transcription' ||
        meeting.status === 'Failed_LLM' ||
        meeting.status === 'Failed_System') && (
        <ErrorDisplay
          meetingId={meetingId}
          error={meeting.latestError}
          onRetry={loadMeeting}
          autoRetryCount={meeting.autoRetryCount}
          lastAutoRetryAt={meeting.lastAutoRetryAt}
          nextAutoRetryAt={meeting.nextAutoRetryAt}
        />
      )}

      <ProcessingStatus
        status={meeting.status}
        hasTranscript={meeting.hasTranscript}
        hasArtifacts={meeting.hasArtifacts}
      />

      {meeting.errorHistory && meeting.errorHistory.length > 0 && (
        <ErrorHistory errors={meeting.errorHistory} />
      )}

      {meeting.hasTranscript && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Транскрипция</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsTranscriptExpanded(!isTranscriptExpanded)}
                className="h-8 w-8 p-0"
              >
                {isTranscriptExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardHeader>
          {isTranscriptExpanded && (
            <CardContent>
              <TranscriptViewer meetingId={meetingId} />
            </CardContent>
          )}
        </Card>
      )}

      {meeting.hasArtifacts && (
        <Card>
          <CardHeader>
            <CardTitle>Артефакты</CardTitle>
            <CardDescription>
              Результаты обработки LLM
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ArtifactsViewer meetingId={meetingId} />
          </CardContent>
        </Card>
      )}

      {canValidate && (
        <Card>
          <CardHeader>
            <CardTitle>Валидация</CardTitle>
            <CardDescription>
              Примите или отклоните результаты обработки
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ValidationActions
              meetingId={meetingId}
              onValidate={handleValidate}
            />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Участники</CardTitle>
          </CardHeader>
          <CardContent>
            <MeetingParticipantsList participants={meeting.participants} />
          </CardContent>
        </Card>

        {isOwner && (
          <Card>
            <CardHeader>
              <CardTitle>Просматривающие</CardTitle>
            </CardHeader>
            <CardContent>
              <MeetingViewersList
                meetingId={meetingId}
                viewers={meeting.viewers}
                onUpdate={loadMeeting}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

