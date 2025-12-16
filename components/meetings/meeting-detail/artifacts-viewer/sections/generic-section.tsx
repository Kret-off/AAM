'use client';

import { SectionCard } from '../components/section-card';
import { FileText } from 'lucide-react';

interface GenericSectionProps {
  title: string;
  data: unknown;
}

/**
 * Generic section renderer for unknown/unspecified artifact sections
 * Renders data as formatted JSON
 */
export function GenericSection({ title, data }: GenericSectionProps) {
  if (!data) {
    return null;
  }

  return (
    <SectionCard title={title} icon={<FileText className="h-5 w-5" />}>
      <div className="space-y-2">
        <pre className="text-sm text-gray-600 whitespace-pre-wrap font-mono bg-gray-50 p-4 rounded border">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    </SectionCard>
  );
}







