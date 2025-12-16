/**
 * API Route: Meeting Events (SSE)
 * 
 * GET /api/meetings/[meetingId]/events
 * 
 * Server-Sent Events (SSE) stream for real-time meeting status updates.
 * 
 * This endpoint establishes a persistent connection and streams status update events
 * to the client when meeting status changes. Uses Redis Pub/Sub for event distribution.
 * 
 * Authentication: Required (via cookie)
 * Authorization: User must have access to the meeting (owner, viewer, or admin)
 * 
 * Event Format:
 * - event: "connected" - Initial connection confirmation
 * - event: "status" - Status update event with meeting data
 * - event: "error" - Connection error
 * 
 * @example
 * ```typescript
 * const eventSource = new EventSource('/api/meetings/abc123/events');
 * eventSource.addEventListener('status', (e) => {
 *   const data = JSON.parse(e.data);
 *   console.log('Status:', data.status);
 * });
 * ```
 */

import { NextRequest } from 'next/server';
import { getTokenFromRequest, verifyToken } from '@/lib/auth/jwt';
import { AUTH_ERROR_CODES, AUTH_ERROR_MESSAGES } from '@/lib/auth/constants';
import { prisma } from '@/lib/prisma';
import { validateMeetingId } from '@/lib/meeting/validation';
import { checkMeetingAccess } from '@/lib/meeting/rbac';
import { getRedisConnection } from '@/lib/queue';
import Redis from 'ioredis';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  try {
    const { meetingId } = await params;

    // Validate meeting ID format
    const idValidation = validateMeetingId(meetingId);
    if (!idValidation.valid) {
      return new Response(
        JSON.stringify({
          error: {
            code: idValidation.error!.code,
            message: idValidation.error!.message,
          },
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Get token from cookies
    const cookieHeader = request.headers.get('cookie');
    const token = getTokenFromRequest(cookieHeader);

    if (!token) {
      return new Response(
        JSON.stringify({
          error: {
            code: AUTH_ERROR_CODES.UNAUTHORIZED,
            message: AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.UNAUTHORIZED],
          },
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Verify token
    const payload = verifyToken(token);
    if (!payload) {
      return new Response(
        JSON.stringify({
          error: {
            code: AUTH_ERROR_CODES.INVALID_SESSION,
            message: AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.INVALID_SESSION],
          },
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Get user from database to get role
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        role: true,
        isActive: true,
      },
    });

    if (!user) {
      return new Response(
        JSON.stringify({
          error: {
            code: AUTH_ERROR_CODES.USER_NOT_FOUND,
            message: AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.USER_NOT_FOUND],
          },
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (!user.isActive) {
      return new Response(
        JSON.stringify({
          error: {
            code: AUTH_ERROR_CODES.USER_INACTIVE,
            message: AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES.USER_INACTIVE],
          },
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Check meeting access (RBAC)
    const accessCheck = await checkMeetingAccess(meetingId, user.id, user.role);
    if (!accessCheck.allowed) {
      return new Response(
        JSON.stringify({
          error: {
            code: accessCheck.error!.code,
            message: accessCheck.error!.message,
          },
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Create SSE stream
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const channel = `meeting:${meetingId}:status`;

        // Send initial connection message
        const initialMessage = `event: connected\ndata: ${JSON.stringify({ meetingId, timestamp: new Date().toISOString() })}\n\n`;
        controller.enqueue(encoder.encode(initialMessage));

        // Subscribe to Redis channel (use separate connection for pub/sub)
        const subscriber = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
          maxRetriesPerRequest: null,
        });
        
        let isClosed = false;

        const cleanup = async () => {
          if (isClosed) return;
          isClosed = true;
          try {
            await subscriber.unsubscribe(channel);
            subscriber.quit();
            controller.close();
            console.log(`[SSE] Cleaned up connection for meeting ${meetingId}`);
          } catch (error) {
            console.error(`[SSE] Error during cleanup for meeting ${meetingId}:`, error);
          }
        };

        subscriber.on('message', (ch, message) => {
          if (ch === channel && !isClosed) {
            try {
              const eventData = JSON.parse(message);
              const sseMessage = `event: status\ndata: ${JSON.stringify(eventData)}\n\n`;
              
              // Check if controller is still open before enqueueing
              try {
                controller.enqueue(encoder.encode(sseMessage));
              } catch (enqueueError: any) {
                // Controller is closed, mark as closed and stop processing
                if (enqueueError?.message?.includes('closed') || enqueueError?.message?.includes('Controller')) {
                  isClosed = true;
                  cleanup();
                  return;
                }
                throw enqueueError;
              }
            } catch (error) {
              console.error('[SSE] Error parsing event message:', error);
            }
          }
        });

        subscriber.on('error', (error) => {
          console.error('[SSE] Redis subscriber error:', error);
          if (!isClosed) {
            const errorMessage = `event: error\ndata: ${JSON.stringify({ message: 'Connection error' })}\n\n`;
            controller.enqueue(encoder.encode(errorMessage));
          }
        });

        try {
          await subscriber.subscribe(channel);
          console.log(`[SSE] Subscribed to channel: ${channel} for meeting ${meetingId}`);
        } catch (error) {
          console.error(`[SSE] Failed to subscribe to channel ${channel}:`, error);
          await cleanup();
          return;
        }

        // Handle client disconnect
        if (request.signal) {
          request.signal.addEventListener('abort', () => {
            console.log(`[SSE] Client disconnected from meeting ${meetingId}`);
            cleanup();
          });
        }

        // Also handle stream cancellation
        const cancelHandler = () => {
          console.log(`[SSE] Stream cancelled for meeting ${meetingId}`);
          cleanup();
        };

        // Return cleanup function for stream cancellation
        return cancelHandler;
      },
      cancel() {
        console.log(`[SSE] Stream cancelled for meeting ${meetingId}`);
      },
    });

    // Return SSE response
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      },
    });
  } catch (error) {
    console.error('[SSE] Error in events route:', error);
    return new Response(
      JSON.stringify({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to establish event stream',
          details: { originalError: error instanceof Error ? error.message : 'Unknown error' },
        },
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

