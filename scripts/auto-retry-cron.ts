/**
 * Auto Retry Cron Job
 * Runs every 5 minutes to check for meetings that need automatic retry
 */

import * as cron from 'node-cron';
import { scheduleAutoRetries } from '../lib/orchestrator/auto-retry-worker';

const CRON_SCHEDULE = '*/5 * * * *'; // Every 5 minutes

console.log('[AutoRetry Cron] Starting auto-retry cron job...');
console.log(`[AutoRetry Cron] Schedule: ${CRON_SCHEDULE} (every 5 minutes)`);

// Run immediately on startup
scheduleAutoRetries()
  .then((count) => {
    console.log(`[AutoRetry Cron] Initial run completed: ${count} retries scheduled`);
  })
  .catch((error) => {
    console.error('[AutoRetry Cron] Initial run failed:', error);
  });

// Schedule recurring job
cron.schedule(CRON_SCHEDULE, async () => {
  console.log('[AutoRetry Cron] Running scheduled auto-retry check...');
  try {
    const count = await scheduleAutoRetries();
    console.log(`[AutoRetry Cron] Scheduled ${count} retries`);
  } catch (error) {
    console.error('[AutoRetry Cron] Error in scheduled run:', error);
  }
});

console.log('[AutoRetry Cron] Auto-retry cron job started successfully');

// Keep process alive
process.on('SIGINT', () => {
  console.log('[AutoRetry Cron] Received SIGINT, shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('[AutoRetry Cron] Received SIGTERM, shutting down...');
  process.exit(0);
});








