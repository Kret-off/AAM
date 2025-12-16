'use client';

import { useState, useEffect } from 'react';
import { apiGet } from '@/lib/api-client';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { Copy, FileText, Code } from 'lucide-react';
import { ArtifactsPayload, ArtifactsConfig } from '@/lib/artifacts/types';
import { ArtifactsResponse } from '@/lib/artifacts/dto';
import { ArtifactsViewMode } from './artifacts-viewer/types';
import { StructuredArtifactsView } from './artifacts-viewer/structured-view';
import { JSONArtifactsView } from './artifacts-viewer/json-view';

interface ArtifactsViewerProps {
  meetingId: string;
}

export function ArtifactsViewer({ meetingId }: ArtifactsViewerProps) {
  const [artifacts, setArtifacts] = useState<ArtifactsPayload | null>(null);
  const [artifactsConfig, setArtifactsConfig] = useState<ArtifactsConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ArtifactsViewMode>('structured');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadArtifacts();
  }, [meetingId]);

  const loadArtifacts = async () => {
    try {
      const response = await apiGet<ArtifactsResponse>(
        `/api/meetings/${meetingId}/artifacts`
      );

      if (response.data) {
        setArtifacts(response.data.artifacts as ArtifactsPayload);
        setArtifactsConfig(response.data.artifactsConfig as ArtifactsConfig);
      }
    } catch (err) {
      console.error('Failed to load artifacts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (artifacts) {
      navigator.clipboard.writeText(JSON.stringify(artifacts, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!artifacts) {
    return <p className="text-sm text-gray-500">Артефакты не найдены</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'structured' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('structured')}
          >
            <FileText className="mr-2 h-4 w-4" />
            Читаемый вид
          </Button>
          <Button
            variant={viewMode === 'json' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('json')}
          >
            <Code className="mr-2 h-4 w-4" />
            JSON
          </Button>
        </div>
        {viewMode === 'structured' && (
          <Button variant="outline" size="sm" onClick={handleCopy}>
            {copied ? (
              <>
                <Copy className="mr-2 h-4 w-4" />
                Скопировано
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" />
                Копировать JSON
              </>
            )}
          </Button>
        )}
      </div>

      {viewMode === 'structured' ? (
        <StructuredArtifactsView
          artifacts={artifacts}
          artifactsConfig={artifactsConfig || undefined}
        />
      ) : (
        <JSONArtifactsView artifacts={artifacts} />
      )}
    </div>
  );
}


