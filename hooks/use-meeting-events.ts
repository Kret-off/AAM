/**
 * Hook for subscribing to meeting status updates via Server-Sent Events (SSE)
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { MeetingStatusUpdateEvent } from '@/lib/realtime/pubsub';

export type EventSourceStatus = 'connecting' | 'connected' | 'error' | 'closed';

export interface UseMeetingEventsOptions {
  /**
   * Callback when status update is received
   */
  onStatusUpdate?: (event: MeetingStatusUpdateEvent) => void;
  /**
   * Callback when connection is established
   */
  onConnect?: () => void;
  /**
   * Callback when connection error occurs
   */
  onError?: (error: Event) => void;
  /**
   * Enable automatic reconnection on error (default: true)
   */
  autoReconnect?: boolean;
  /**
   * Maximum reconnection attempts (default: 5)
   */
  maxReconnectAttempts?: number;
  /**
   * Initial delay for reconnection in ms (default: 1000)
   */
  reconnectDelay?: number;
}

export interface UseMeetingEventsReturn {
  /**
   * Current connection status
   */
  status: EventSourceStatus;
  /**
   * Manually close the connection
   */
  close: () => void;
  /**
   * Manually reconnect (if closed)
   */
  reconnect: () => void;
}

/**
 * Hook to subscribe to meeting status updates via SSE
 * 
 * Automatically connects to the SSE endpoint when meetingId is provided and
 * manages the connection lifecycle. Handles reconnection with exponential backoff
 * on errors.
 * 
 * @param meetingId - Meeting ID to subscribe to (null to disconnect)
 * @param options - Configuration options
 * @param options.onStatusUpdate - Callback when status update is received
 * @param options.onConnect - Callback when connection is established
 * @param options.onError - Callback when connection error occurs
 * @param options.autoReconnect - Enable automatic reconnection (default: true)
 * @param options.maxReconnectAttempts - Maximum reconnection attempts (default: 5)
 * @param options.reconnectDelay - Initial delay for reconnection in ms (default: 1000)
 * @returns Connection status and control functions
 * 
 * @example
 * ```typescript
 * const { status, close } = useMeetingEvents(meetingId, {
 *   onStatusUpdate: (event) => {
 *     setMeetingStatus(event.status);
 *   },
 * });
 * ```
 */
export function useMeetingEvents(
  meetingId: string | null,
  options: UseMeetingEventsOptions = {}
): UseMeetingEventsReturn {
  const {
    onStatusUpdate,
    onConnect,
    onError,
    autoReconnect = true,
    maxReconnectAttempts = 5,
    reconnectDelay = 1000,
  } = options;

  const [status, setStatus] = useState<EventSourceStatus>('closed');
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isManualCloseRef = useRef(false);
  const isConnectingRef = useRef(false);
  // Store callbacks in refs to avoid recreating connection on every render
  const onStatusUpdateRef = useRef(onStatusUpdate);
  const onConnectRef = useRef(onConnect);
  const onErrorRef = useRef(onError);

  // Update refs when callbacks change
  useEffect(() => {
    onStatusUpdateRef.current = onStatusUpdate;
    onConnectRef.current = onConnect;
    onErrorRef.current = onError;
  }, [onStatusUpdate, onConnect, onError]);

  const close = useCallback(() => {
    isManualCloseRef.current = true;
    isConnectingRef.current = false;
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setStatus('closed');
    reconnectAttemptsRef.current = 0;
  }, []);

  const connect = useCallback(() => {
    if (!meetingId) {
      return;
    }

    // Prevent multiple simultaneous connections
    if (isConnectingRef.current || (eventSourceRef.current && eventSourceRef.current.readyState !== EventSource.CLOSED)) {
      return;
    }

    // Close existing connection if any
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    isConnectingRef.current = true;
    isManualCloseRef.current = false;
    setStatus('connecting');

    try {
      const eventSource = new EventSource(`/api/meetings/${meetingId}/events`);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        isConnectingRef.current = false;
        console.log(`[useMeetingEvents] Connected to meeting ${meetingId}`);
        setStatus('connected');
        reconnectAttemptsRef.current = 0;
        onConnectRef.current?.();
      };

      eventSource.addEventListener('status', (event: MessageEvent) => {
        try {
          const data: MeetingStatusUpdateEvent = JSON.parse(event.data);
          console.log(`[useMeetingEvents] Status update received:`, data);
          onStatusUpdateRef.current?.(data);
        } catch (error) {
          console.error('[useMeetingEvents] Error parsing status event:', error);
        }
      });

      eventSource.addEventListener('connected', (event: MessageEvent) => {
        console.log(`[useMeetingEvents] SSE connection established for meeting ${meetingId}`);
      });

      eventSource.onerror = (error) => {
        isConnectingRef.current = false;
        console.error(`[useMeetingEvents] EventSource error for meeting ${meetingId}:`, error);
        setStatus('error');
        onErrorRef.current?.(error);

        // Auto-reconnect if enabled and not manually closed
        if (autoReconnect && !isManualCloseRef.current && eventSource.readyState === EventSource.CLOSED) {
          if (reconnectAttemptsRef.current < maxReconnectAttempts) {
            reconnectAttemptsRef.current += 1;
            const delay = reconnectDelay * Math.pow(2, reconnectAttemptsRef.current - 1); // Exponential backoff
            console.log(
              `[useMeetingEvents] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`
            );
            reconnectTimeoutRef.current = setTimeout(() => {
              connect();
            }, delay);
          } else {
            console.error(
              `[useMeetingEvents] Max reconnection attempts (${maxReconnectAttempts}) reached for meeting ${meetingId}`
            );
            setStatus('error');
          }
        } else if (isManualCloseRef.current) {
          setStatus('closed');
        }
      };
    } catch (error) {
      console.error(`[useMeetingEvents] Failed to create EventSource for meeting ${meetingId}:`, error);
      setStatus('error');
      onError?.(error as Event);
    }
  }, [meetingId, onStatusUpdate, onConnect, onError, autoReconnect, maxReconnectAttempts, reconnectDelay]);

  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    isManualCloseRef.current = false;
    connect();
  }, [connect]);

  useEffect(() => {
    if (meetingId) {
      connect();
    } else {
      close();
    }

    // Cleanup on unmount or meetingId change
    return () => {
      close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId]); // Only depend on meetingId, not connect/close functions

  return {
    status,
    close,
    reconnect,
  };
}

