/**
 * Queue Worker
 * BullMQ worker for processing jobs
 */

import { Worker, Job } from 'bullmq';
import { getRedisConnection, getProcessingQueue } from './queue';

let processingWorker: Worker | undefined;

/**
 * Get processing worker instance
 */
export function getProcessingWorker(): Worker {
  if (!processingWorker) {
    processingWorker = new Worker(
      'processing',
      async (job: Job<{ meetingId: string }>) => {
        console.log(`Processing job ${job.id} for meeting ${job.data.meetingId}`);
        // Job processing logic will be implemented in orchestrator
        // This is a basic worker structure
        return { success: true, meetingId: job.data.meetingId };
      },
      {
        connection: getRedisConnection(),
        concurrency: 5, // Process up to 5 jobs concurrently
        removeOnComplete: {
          count: 100, // Keep last 100 completed jobs
        },
        removeOnFail: {
          count: 1000, // Keep last 1000 failed jobs
        },
      }
    );

    // Error handling
    processingWorker.on('failed', (job, err) => {
      logger.error(`Job ${job?.id} failed`, err);
    });

    processingWorker.on('completed', (job) => {
      logger.info(`Job ${job.id} completed successfully`);
    });

    processingWorker.on('error', (err) => {
      logger.error('Worker error', err);
    });
  }

  return processingWorker;
}

/**
 * Start processing worker
 */
export function startProcessingWorker(): Worker {
  return getProcessingWorker();
}

/**
 * Stop processing worker
 */
export async function stopProcessingWorker(): Promise<void> {
  if (processingWorker) {
    await processingWorker.close();
    processingWorker = undefined;
  }
}








