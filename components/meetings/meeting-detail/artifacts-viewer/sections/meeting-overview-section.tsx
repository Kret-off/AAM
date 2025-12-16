'use client';

import { SectionCard } from '../components/section-card';
import { FileText, Calendar, FileText as FileTextIcon, MessageSquare } from 'lucide-react';

interface MeetingOverviewSectionProps {
  data: unknown;
}

/**
 * Map field keys to human-readable labels and icons
 */
const fieldLabels: Record<string, { label: string; icon: React.ReactNode }> = {
  meeting_type: { label: 'Тип встречи', icon: <Calendar className="h-4 w-4 text-gray-400" /> },
  meeting_summary: { label: 'Резюме встречи', icon: <FileTextIcon className="h-4 w-4 text-gray-400" /> },
  discussion_topic_main: { label: 'Основная тема обсуждения', icon: <MessageSquare className="h-4 w-4 text-gray-400" /> },
};

/**
 * Get human-readable label for field key
 */
function getFieldLabel(key: string): { label: string; icon: React.ReactNode } {
  return fieldLabels[key] || { label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), icon: <FileTextIcon className="h-4 w-4 text-gray-400" /> };
}

/**
 * Render meeting overview data - handles various formats
 */
function renderMeetingOverview(data: unknown) {
  if (!data) {
    return null;
  }

  // If it's a string, render as text
  if (typeof data === 'string') {
    return <p className="text-sm text-gray-700 whitespace-pre-wrap">{data}</p>;
  }

  // If it's an array, render as list
  if (Array.isArray(data)) {
    if (data.length === 0) {
      return null;
    }
    return (
      <ul className="space-y-2">
        {data.map((item, idx) => (
          <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
            <span className="text-blue-600 mt-1">•</span>
            <span>{typeof item === 'string' ? item : JSON.stringify(item)}</span>
          </li>
        ))}
      </ul>
    );
  }

  // If it's an object, render with proper formatting
  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;
    const entries = Object.entries(obj);
    
    if (entries.length === 0) {
      return null;
    }

    return (
      <div className="space-y-4">
        {entries.map(([key, value]) => {
          const { label, icon } = getFieldLabel(key);
          
          return (
            <div key={key} className="flex items-start gap-3">
              <span className="mt-0.5">{icon}</span>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700 mb-1">{label}</p>
                {Array.isArray(value) ? (
                  <ul className="text-sm text-gray-600 space-y-1 ml-4">
                    {value.map((item, idx) => (
                      <li key={idx}>• {typeof item === 'string' ? item : JSON.stringify(item)}</li>
                    ))}
                  </ul>
                ) : typeof value === 'string' ? (
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{value}</p>
                ) : (
                  <p className="text-sm text-gray-600">{JSON.stringify(value, null, 2)}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return <p className="text-sm text-gray-700">{String(data)}</p>;
}

export function MeetingOverviewSection({ data }: MeetingOverviewSectionProps) {
  const content = renderMeetingOverview(data);
  
  if (!content) {
    return null;
  }

  return (
    <SectionCard title="Обзор встречи" icon={<FileText className="h-5 w-5" />}>
      {content}
    </SectionCard>
  );
}




