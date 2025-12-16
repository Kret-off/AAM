'use client';

import { SectionCard } from '../components/section-card';
import { MessageSquare } from 'lucide-react';

interface DiscussionTopicsDetailedSectionProps {
  data: unknown;
}

/**
 * Render discussion topics - handles various formats
 */
function renderDiscussionTopics(data: unknown) {
  if (!data) {
    return null;
  }

  // If it's an array of strings, render as list
  if (Array.isArray(data)) {
    if (data.length === 0) {
      return null;
    }
    return (
      <div className="space-y-3">
        {data.map((topic, idx) => (
          <div key={idx} className="border border-gray-200 rounded-lg p-4">
            {typeof topic === 'string' ? (
              <p className="text-sm text-gray-700">{topic}</p>
            ) : typeof topic === 'object' && topic !== null ? (
              <div className="space-y-2">
                {Object.entries(topic as Record<string, unknown>).map(([key, value]) => (
                  <div key={key}>
                    <p className="text-xs font-medium text-gray-500 mb-1">{key}:</p>
                    <p className="text-sm text-gray-700">
                      {typeof value === 'string' ? value : JSON.stringify(value)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-700">{String(topic)}</p>
            )}
          </div>
        ))}
      </div>
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
          // Convert snake_case to readable label
          const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          
          return (
            <div key={key} className="border border-gray-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-gray-900 mb-2">{label}</p>
              {Array.isArray(value) ? (
                <ul className="text-sm text-gray-700 space-y-2 ml-4">
                  {value.map((item, idx) => (
                    <li key={idx}>• {typeof item === 'string' ? item : JSON.stringify(item)}</li>
                  ))}
                </ul>
              ) : typeof value === 'string' ? (
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{value}</p>
              ) : (
                <p className="text-sm text-gray-700">{JSON.stringify(value, null, 2)}</p>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // If it's a string, render as text
  if (typeof data === 'string') {
    return <p className="text-sm text-gray-700 whitespace-pre-wrap">{data}</p>;
  }

  return <p className="text-sm text-gray-700">{String(data)}</p>;
}

export function DiscussionTopicsDetailedSection({ data }: DiscussionTopicsDetailedSectionProps) {
  const content = renderDiscussionTopics(data);
  
  if (!content) {
    return null;
  }

  return (
    <SectionCard title="Детальные темы обсуждения" icon={<MessageSquare className="h-5 w-5" />}>
      {content}
    </SectionCard>
  );
}




