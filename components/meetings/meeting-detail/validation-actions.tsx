'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ValidationActionsProps {
  meetingId: string;
  onValidate: (decision: 'accepted' | 'rejected', reason?: string) => void;
}

export function ValidationActions({
  meetingId,
  onValidate,
}: ValidationActionsProps) {
  const [decision, setDecision] = useState<'accepted' | 'rejected' | null>(
    null
  );
  const [rejectionReason, setRejectionReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    if (!decision) {
      setError('Выберите решение');
      return;
    }

    if (decision === 'rejected' && !rejectionReason.trim()) {
      setError('Укажите причину отклонения');
      return;
    }

    setError(null);
    onValidate(decision, rejectionReason || undefined);
  };

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label>Решение</Label>
        <div className="flex gap-4">
          <Button
            variant={decision === 'accepted' ? 'default' : 'outline'}
            onClick={() => setDecision('accepted')}
          >
            Принять
          </Button>
          <Button
            variant={decision === 'rejected' ? 'destructive' : 'outline'}
            onClick={() => setDecision('rejected')}
          >
            Отклонить
          </Button>
        </div>
      </div>

      {decision === 'rejected' && (
        <div className="space-y-2">
          <Label htmlFor="rejectionReason">Причина отклонения</Label>
          <Input
            id="rejectionReason"
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="Укажите причину отклонения..."
          />
        </div>
      )}

      {decision && (
        <Button onClick={handleSubmit} className="w-full">
          Подтвердить
        </Button>
      )}
    </div>
  );
}








