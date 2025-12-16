/**
 * Script to clear locks for meetings
 */

import Redis from 'ioredis';

async function clearLocks(meetingIds: string[]) {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const redis = new Redis(redisUrl);

  try {
    console.log('\n🗑️  Clearing locks for meetings:\n');

    for (const meetingId of meetingIds) {
      const lockKey = `lock:meeting:${meetingId}`;
      const deleted = await redis.del(lockKey);
      
      if (deleted > 0) {
        console.log(`  ✅ Lock cleared for meeting ${meetingId}`);
      } else {
        console.log(`  ℹ️  No lock found for meeting ${meetingId}`);
      }
    }

    console.log('\n✅ Done!\n');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await redis.quit();
  }
}

const meetingIds = process.argv.slice(2);
if (meetingIds.length === 0) {
  console.error('Usage: npx tsx scripts/clear-locks.ts <meetingId1> <meetingId2> ...');
  process.exit(1);
}

clearLocks(meetingIds).then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});








