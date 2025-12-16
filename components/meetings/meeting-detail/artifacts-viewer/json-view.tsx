'use client';

import { ArtifactsPayload } from '@/lib/artifacts/types';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';
import { useState } from 'react';

interface JSONArtifactsViewProps {
  artifacts: ArtifactsPayload;
}

export function JSONArtifactsView({ artifacts }: JSONArtifactsViewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(artifacts, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleCopy}>
          {copied ? (
            <>
              <Check className="mr-2 h-4 w-4" />
              Скопировано
            </>
          ) : (
            <>
              <Copy className="mr-2 h-4 w-4" />
              Копировать JSON
            </>
          )}
        </Button>
      </div>
      <pre className="overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm">
        {JSON.stringify(artifacts, null, 2)}
      </pre>
    </div>
  );
}







