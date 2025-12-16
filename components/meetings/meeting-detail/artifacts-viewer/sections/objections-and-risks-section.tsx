'use client';

import { SectionCard } from '../components/section-card';
import { AlertTriangle, XCircle } from 'lucide-react';

interface ObjectionsAndRisksSectionProps {
  data: unknown;
}

/**
 * Render objections and risks - handles various formats
 */
function renderObjectionsAndRisks(data: unknown) {
  if (!data) {
    return null;
  }

  // If it's an object with objections and risks
  if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    const hasObjections = obj.objections && (Array.isArray(obj.objections) ? obj.objections.length > 0 : true);
    const hasRisks = obj.risks && (Array.isArray(obj.risks) ? obj.risks.length > 0 : true);
    
    if (!hasObjections && !hasRisks) {
      // Try to render other fields
      const otherEntries = Object.entries(obj).filter(([key]) => key !== 'objections' && key !== 'risks');
      if (otherEntries.length === 0) {
        return null;
      }
      
      return (
        <div className="space-y-4">
          {otherEntries.map(([key, value]) => {
            // Convert snake_case to readable label
            const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            
            return (
              <div key={key} className="flex items-start gap-3">
                <AlertTriangle className="h-4 w-4 mt-0.5 text-gray-400" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-700 mb-1">{label}</p>
                  {Array.isArray(value) ? (
                    <ul className="text-sm text-gray-600 space-y-2 ml-4">
                      {value.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-red-600 mt-1">•</span>
                          <span>{typeof item === 'string' ? item : JSON.stringify(item)}</span>
                        </li>
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

    return (
      <div className="space-y-5">
        {hasObjections && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <XCircle className="h-4 w-4 text-orange-600" />
              <p className="text-sm font-semibold text-gray-900">Возражения:</p>
            </div>
            {Array.isArray(obj.objections) ? (
              <ul className="space-y-2">
                {obj.objections.map((objection, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                    <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                    <span>{typeof objection === 'string' ? objection : JSON.stringify(objection)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-700">{String(obj.objections)}</p>
            )}
          </div>
        )}

        {hasRisks && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <p className="text-sm font-semibold text-gray-900">Риски:</p>
            </div>
            {Array.isArray(obj.risks) ? (
              <ul className="space-y-2">
                {obj.risks.map((risk, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                    <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <span>{typeof risk === 'string' ? risk : JSON.stringify(risk)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-700">{String(obj.risks)}</p>
            )}
          </div>
        )}
      </div>
    );
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
            <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
            <span>{typeof item === 'string' ? item : JSON.stringify(item)}</span>
          </li>
        ))}
      </ul>
    );
  }

  // If it's a string, render as text
  if (typeof data === 'string') {
    return <p className="text-sm text-gray-700 whitespace-pre-wrap">{data}</p>;
  }

  return <p className="text-sm text-gray-700">{String(data)}</p>;
}

export function ObjectionsAndRisksSection({ data }: ObjectionsAndRisksSectionProps) {
  const content = renderObjectionsAndRisks(data);
  
  if (!content) {
    return null;
  }

  return (
    <SectionCard title="Возражения и риски" icon={<AlertTriangle className="h-5 w-5" />}>
      {content}
    </SectionCard>
  );
}




