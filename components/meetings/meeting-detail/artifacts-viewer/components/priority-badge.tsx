'use client';

import { PainPriority } from '@/lib/artifacts/types';
import { Badge } from '@/components/ui/badge';

interface PriorityBadgeProps {
  priority: PainPriority;
  className?: string;
}

const priorityLabels: Record<NonNullable<PainPriority>, string> = {
  high: 'Высокий',
  medium: 'Средний',
  low: 'Низкий',
};

const priorityColors: Record<NonNullable<PainPriority>, string> = {
  high: 'bg-red-100 text-red-800 border-red-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  low: 'bg-green-100 text-green-800 border-green-200',
};

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  if (!priority) {
    return null;
  }

  return (
    <Badge
      variant="outline"
      className={`border ${priorityColors[priority]} ${className || ''}`}
    >
      {priorityLabels[priority]}
    </Badge>
  );
}







