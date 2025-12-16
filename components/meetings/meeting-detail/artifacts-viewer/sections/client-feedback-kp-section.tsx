'use client';

import { SectionCard } from '../components/section-card';
import { MessageSquare, DollarSign, Target, Clock, Settings, FileText } from 'lucide-react';
import { EvidenceBlock } from '../components/evidence-block';

interface FeedbackComment {
  comment: string;
  evidence: {
    quote: string;
    speaker: 'client' | 'our_team' | 'unknown';
  };
}

interface RequestedChange {
  change: string;
  evidence: {
    quote: string;
    speaker: 'client';
  };
}

interface ClientFeedbackKPData {
  overall_reaction?: string;
  comments?: {
    cost?: FeedbackComment[];
    scope?: FeedbackComment[];
    timelines?: FeedbackComment[];
    functionality_and_integrations?: FeedbackComment[];
    format_and_payment?: FeedbackComment[];
    requested_changes_to_proposal?: RequestedChange[];
  };
}

interface ClientFeedbackKPSectionProps {
  data: ClientFeedbackKPData | undefined;
}

const commentCategoryIcons = {
  cost: DollarSign,
  scope: Target,
  timelines: Clock,
  functionality_and_integrations: Settings,
  format_and_payment: FileText,
};

const commentCategoryLabels = {
  cost: 'Стоимость',
  scope: 'Объем работ',
  timelines: 'Сроки',
  functionality_and_integrations: 'Функционал и интеграции',
  format_and_payment: 'Формат работы и оплата',
  requested_changes_to_proposal: 'Запрошенные изменения',
};

export function ClientFeedbackKPSection({ data }: ClientFeedbackKPSectionProps) {
  if (!data) {
    return null;
  }

  return (
    <SectionCard title="Обратная связь по КП" icon={<MessageSquare className="h-5 w-5" />}>
      <div className="space-y-6">
        {data.overall_reaction && (
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-xs font-medium text-blue-700 mb-2">Общая реакция:</p>
            <p className="text-sm text-blue-900">{data.overall_reaction}</p>
          </div>
        )}

        {data.comments && (
          <div className="space-y-5">
            {Object.entries(data.comments).map(([category, comments]) => {
              if (!comments || (Array.isArray(comments) && comments.length === 0)) {
                return null;
              }

              const Icon = commentCategoryIcons[category as keyof typeof commentCategoryIcons];
              const label = commentCategoryLabels[category as keyof typeof commentCategoryLabels] || category;

              return (
                <div key={category}>
                  <div className="flex items-center gap-2 mb-3">
                    {Icon && <Icon className="h-4 w-4 text-gray-500" />}
                    <p className="text-sm font-semibold text-gray-900">{label}:</p>
                  </div>

                  <div className="space-y-3">
                    {Array.isArray(comments) &&
                      comments.map((comment, idx) => (
                        <div key={idx} className="border border-gray-200 rounded-lg p-4 space-y-3">
                          {'comment' in comment ? (
                            <>
                              <p className="text-sm text-gray-700">{comment.comment}</p>
                              {comment.evidence && (
                                <div>
                                  <p className="text-xs font-medium text-gray-500 mb-2">Доказательство:</p>
                                  <EvidenceBlock evidence={comment.evidence} />
                                </div>
                              )}
                            </>
                          ) : (
                            <>
                              <p className="text-sm text-gray-700">{comment.change}</p>
                              {comment.evidence && (
                                <div>
                                  <p className="text-xs font-medium text-gray-500 mb-2">Доказательство:</p>
                                  <EvidenceBlock evidence={comment.evidence} />
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </SectionCard>
  );
}




