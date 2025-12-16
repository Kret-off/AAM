/**
 * Queue Shutdown Utilities
 * Graceful shutdown for BullMQ queues and workers
 */

import { Queue } from 'bullmq';
import { getProcessingQueue } from './queue';
import { stopProcessingWorker } from './queue-worker';

/**
 * Gracefully shutdown queue
 */
export async function shutdownQueue(queue: Queue): Promise<void> {
  try {
    // Wait for active jobs to complete (with timeout)
    await queue.close();
    console.log('Queue closed gracefully');
  } catch (error) {
    console.error('Error closing queue:', error);
    throw error;
  }
}

/**
 * Gracefully shutdown all queues and workers
 */
export async function shutdownAll(): Promise<void> {
  console.log('Shutting down queues and workers...');

  try {
    // Stop worker first
    await stopProcessingWorker();

    // Close queue
    const queue = getProcessingQueue();
    await shutdownQueue(queue);

    console.log('All queues and workers shut down successfully');
  } catch (error) {
    console.error('Error during shutdown:', error);
    throw error;
  }
}

/**
 * Setup graceful shutdown handlers
 */
export function setupGracefulShutdown(): void {
  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}, shutting down gracefully...`);
    try {
      await shutdownAll();
      process.exit(0);
    } catch (error) {
      console.error('Error during graceful shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught exceptions
  process.on('uncaughtException', async (error) => {
    console.error('Uncaught exception:', error);
    try {
      await shutdownAll();
    } catch (shutdownError) {
      console.error('Error during emergency shutdown:', shutdownError);
    }
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', async (reason) => {
    console.error('Unhandled rejection:', reason);
    try {
      await shutdownAll();
    } catch (shutdownError) {
      console.error('Error during emergency shutdown:', shutdownError);
    }
    process.exit(1);
  });
}








