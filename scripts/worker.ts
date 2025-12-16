/**
 * Processing Worker Script
 * Run this separately to process meeting jobs
 * Usage: npm run worker
 */

import { startProcessingWorker, stopProcessingWorker } from '@/lib/orchestrator/workers';

console.log('🚀 Starting processing worker...');

// Start worker
const worker = startProcessingWorker();

worker.on('ready', () => {
  console.log('✅ Processing worker is ready and listening for jobs');
});

worker.on('active', (job) => {
  console.log(`🔄 Processing job ${job.id} for meeting ${job.data.meetingId}`);
});

worker.on('completed', (job) => {
  console.log(`✅ Job ${job.id} completed successfully`);
});

worker.on('failed', (job, err) => {
  console.error(`❌ Job ${job?.id} failed:`, err);
});

worker.on('error', (err) => {
  console.error('❌ Worker error:', err);
});

// Keep process alive and handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n⏹️  Shutting down worker...');
  await stopProcessingWorker();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n⏹️  Shutting down worker...');
  await stopProcessingWorker();
  process.exit(0);
});

