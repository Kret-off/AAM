'use client';

import { SectionCard } from '../components/section-card';
import { UserCheck } from 'lucide-react';

interface ClientConclusionsSectionProps {
  data: unknown;
}

/**
 * Render client conclusions - handles various formats
 */
function renderClientConclusions(data: unknown) {
  if (!data) {
    return null;
  }

  // If it's an array of strings, render as list
  if (Array.isArray(data)) {
    if (data.length === 0) {
      return null;
    }
    return (
      <ul className="space-y-2">
        {data.map((conclusion, idx) => (
          <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
            <span className="text-green-600 mt-1">•</span>
            <span>{typeof conclusion === 'string' ? conclusion : JSON.stringify(conclusion)}</span>
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
          // Convert snake_case to readable label
          const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          
          return (
            <div key={key} className="flex items-start gap-3">
              <UserCheck className="h-4 w-4 mt-0.5 text-gray-400" />
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

  // If it's a string, render as text
  if (typeof data === 'string') {
    return <p className="text-sm text-gray-700 whitespace-pre-wrap">{data}</p>;
  }

  return <p className="text-sm text-gray-700">{String(data)}</p>;
}

export function ClientConclusionsSection({ data }: ClientConclusionsSectionProps) {
  const content = renderClientConclusions(data);
  
  if (!content) {
    return null;
  }

  return (
    <SectionCard title="Выводы клиента" icon={<UserCheck className="h-5 w-5" />}>
      {content}
    </SectionCard>
  );
}




