import * as React from 'react';
import { cn } from '@/lib/utils';
import { MeetingStatus } from '@prisma/client';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          {
            'border-transparent bg-blue-600 text-white': variant === 'default',
            'border-transparent bg-gray-200 text-gray-900': variant === 'secondary',
            'border-transparent bg-red-600 text-white': variant === 'destructive',
            'text-gray-950': variant === 'outline',
          },
          className
        )}
        {...props}
      />
    );
  }
);
Badge.displayName = 'Badge';

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  status: MeetingStatus;
}

const StatusBadge = React.forwardRef<HTMLDivElement, StatusBadgeProps>(
  ({ className, status, ...props }, ref) => {
    const getStatusVariant = (status: MeetingStatus): string => {
      switch (status) {
        case 'Ready':
          return 'bg-green-100 text-green-800 border-green-200';
        case 'Validated':
          return 'bg-blue-100 text-blue-800 border-blue-200';
        case 'Rejected':
          return 'bg-gray-100 text-gray-800 border-gray-200';
        case 'Uploaded':
        case 'Transcribing':
        case 'LLM_Processing':
          return 'bg-yellow-100 text-yellow-800 border-yellow-200';
        case 'Failed_Transcription':
        case 'Failed_LLM':
        case 'Failed_System':
          return 'bg-red-100 text-red-800 border-red-200';
        default:
          return 'bg-gray-100 text-gray-800 border-gray-200';
      }
    };

    const getStatusLabel = (status: MeetingStatus): string => {
      const statusLabels: Record<MeetingStatus, string> = {
        Uploaded: 'Загружено',
        Transcribing: 'Транскрипция',
        LLM_Processing: 'Обработка LLM',
        Ready: 'Готово',
        Validated: 'Принято',
        Rejected: 'Отклонено',
        Failed_Transcription: 'Ошибка транскрипции',
        Failed_LLM: 'Ошибка обработки',
        Failed_System: 'Системная ошибка',
      };
      return statusLabels[status] || status.replace(/_/g, ' ');
    };

    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
          getStatusVariant(status),
          className
        )}
        {...props}
      >
        {getStatusLabel(status)}
      </div>
    );
  }
);
StatusBadge.displayName = 'StatusBadge';

export { Badge, StatusBadge };

