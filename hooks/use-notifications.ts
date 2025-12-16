'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet, apiPost } from '@/lib/api-client';
import { toast } from 'sonner';

export interface Notification {
  id: string;
  meetingId: string;
  meetingTitle: string;
  errorType: 'transcription' | 'llm' | 'system';
  errorMessage: string;
  occurredAt: string;
  isRead: boolean;
}

export interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  markAsRead: (notificationId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const POLLING_INTERVAL = 30000; // 30 seconds
const TOAST_DURATION = 10000; // 10 seconds
const TOAST_STORAGE_KEY = 'aam_toast_shown_ids';

// Helper to get toast shown IDs from localStorage
function getToastShownIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const stored = localStorage.getItem(TOAST_STORAGE_KEY);
    if (stored) {
      const ids = JSON.parse(stored) as string[];
      return new Set(ids);
    }
  } catch (error) {
    console.error('Failed to read toast shown IDs from localStorage:', error);
  }
  return new Set();
}

// Helper to save toast shown IDs to localStorage
function saveToastShownIds(ids: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    const idsArray = Array.from(ids);
    localStorage.setItem(TOAST_STORAGE_KEY, JSON.stringify(idsArray));
  } catch (error) {
    console.error('Failed to save toast shown IDs to localStorage:', error);
  }
}

export function useNotifications(): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const previousNotificationIds = useRef<Set<string>>(new Set());
  const toastShownIds = useRef<Set<string>>(getToastShownIds());

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await apiGet<Notification[]>('/api/notifications');

      if (response.error) {
        setError(response.error.message || 'Ошибка загрузки уведомлений');
        return;
      }

      if (response.data) {
        setNotifications(response.data);
        setError(null);

        // Show toast only for new, unread notifications
        const currentIds = new Set(response.data.map((n) => n.id));
        const newNotifications = response.data.filter(
          (n) => 
            !n.isRead && // Only unread notifications
            !previousNotificationIds.current.has(n.id) && // Was not in previous fetch
            !toastShownIds.current.has(n.id) // Was not shown as toast before
        );

        newNotifications.forEach((notification) => {
          toastShownIds.current.add(notification.id);
          saveToastShownIds(toastShownIds.current); // Persist to localStorage

          const errorTypeLabels: Record<'transcription' | 'llm' | 'system', string> = {
            transcription: 'Транскрипция',
            llm: 'Обработка LLM',
            system: 'Системная ошибка',
          };

          toast.error('Ошибка обработки встречи', {
            description: `${notification.meetingTitle} - ${errorTypeLabels[notification.errorType]}`,
            duration: TOAST_DURATION,
            action: {
              label: 'Перейти',
              onClick: () => {
                router.push(`/meetings/${notification.meetingId}`);
              },
            },
          });
        });

        previousNotificationIds.current = currentIds;
      }
    } catch (err) {
      setError('Произошла ошибка при загрузке уведомлений');
      console.error('Failed to fetch notifications:', err);
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const response = await apiPost<{ success: boolean }>(
        `/api/notifications/${notificationId}/read`,
        {}
      );

      if (response.error) {
        console.error('Failed to mark notification as read:', response.error);
        return;
      }

      // Update local state
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n))
      );
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    await fetchNotifications();
  }, [fetchNotifications]);

  // Initial fetch
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Polling
  useEffect(() => {
    const interval = setInterval(() => {
      fetchNotifications();
    }, POLLING_INTERVAL);

    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    markAsRead,
    refresh,
  };
}






