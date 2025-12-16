/**
 * Check Worker Status Script
 * Checks how many worker instances are running and if there are conflicts
 */

import Redis from 'ioredis';
import { Queue } from 'bullmq';
import { ORCHESTRATOR_CONSTANTS } from '@/lib/orchestrator/constants';

async function checkWorkers() {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
  });

  const queue = new Queue(ORCHESTRATOR_CONSTANTS.QUEUE_NAME, {
    connection: redis,
  });

  console.log('🔍 Checking worker status...\n');
  console.log('='.repeat(60));

  try {
    // Get active workers
    const workers = await queue.getWorkers();
    console.log(`\n📊 Active Workers: ${workers.length}`);
    
    if (workers.length === 0) {
      console.log('⚠️  No active workers found!');
    } else {
      workers.forEach((worker, index) => {
        console.log(`\n  Worker ${index + 1}:`);
        console.log(`    ID: ${worker.id}`);
        console.log(`    Name: ${worker.name}`);
        console.log(`    State: ${worker.state}`);
      });
    }

    // Get active jobs
    const activeJobs = await queue.getActive();
    console.log(`\n🔄 Active Jobs: ${activeJobs.length}`);
    
    if (activeJobs.length > 0) {
      activeJobs.forEach((job, index) => {
        console.log(`\n  Job ${index + 1}:`);
        console.log(`    ID: ${job.id}`);
        console.log(`    Name: ${job.name}`);
        console.log(`    Data: ${JSON.stringify(job.data)}`);
        console.log(`    Processed On: ${job.processedOn}`);
        console.log(`    Attempts Made: ${job.attemptsMade}`);
      });
    }

    // Get waiting jobs
    const waitingJobs = await queue.getWaiting();
    console.log(`\n⏳ Waiting Jobs: ${waitingJobs.length}`);

    // Get completed jobs count
    const completedCount = await queue.getCompletedCount();
    console.log(`\n✅ Completed Jobs: ${completedCount}`);

    // Get failed jobs count
    const failedCount = await queue.getFailedCount();
    console.log(`\n❌ Failed Jobs: ${failedCount}`);

    // Check for duplicate active jobs (same meetingId)
    const meetingIds = new Map<string, number>();
    activeJobs.forEach((job) => {
      const meetingId = (job.data as any)?.meetingId;
      if (meetingId) {
        meetingIds.set(meetingId, (meetingIds.get(meetingId) || 0) + 1);
      }
    });

    const duplicates = Array.from(meetingIds.entries()).filter(([_, count]) => count > 1);
    if (duplicates.length > 0) {
      console.log(`\n⚠️  WARNING: Found duplicate active jobs for the same meetings:`);
      duplicates.forEach(([meetingId, count]) => {
        console.log(`    Meeting ${meetingId}: ${count} active jobs`);
      });
    } else {
      console.log(`\n✅ No duplicate active jobs found`);
    }

    // Check Redis keys for worker info
    const workerKeys = await redis.keys('bull:processing:*:workers');
    console.log(`\n🔑 Redis Worker Keys: ${workerKeys.length}`);
    if (workerKeys.length > 0) {
      for (const key of workerKeys) {
        const workerInfo = await redis.hgetall(key);
        console.log(`\n  Key: ${key}`);
        console.log(`    Info: ${JSON.stringify(workerInfo, null, 2)}`);
      }
    }

    // Check for locks (potential conflicts)
    const lockKeys = await redis.keys('lock:meeting:*');
    console.log(`\n🔒 Active Locks: ${lockKeys.length}`);
    if (lockKeys.length > 0) {
      for (const key of lockKeys) {
        const ttl = await redis.ttl(key);
        const value = await redis.get(key);
        console.log(`\n  Lock: ${key}`);
        console.log(`    TTL: ${ttl}s`);
        console.log(`    Value: ${value}`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n✅ Worker check completed\n');

  } catch (error) {
    console.error('❌ Error checking workers:', error);
  } finally {
    await queue.close();
    await redis.quit();
  }
}

// Run check
checkWorkers().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});




