/**
 * Script to check and clear locks for meetings
 */

import Redis from 'ioredis';

async function checkAndClearLocks(meetingIds: string[]) {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const redis = new Redis(redisUrl);

  try {
    console.log('\n🔍 Checking locks for meetings:\n');

    for (const meetingId of meetingIds) {
      const lockKey = `lock:meeting:${meetingId}`;
      const lockValue = await redis.get(lockKey);
      
      if (lockValue) {
        const ttl = await redis.pttl(lockKey);
        console.log(`  Meeting ${meetingId}:`);
        console.log(`    Lock exists: Yes`);
        console.log(`    Lock value: ${lockValue}`);
        console.log(`    TTL: ${ttl > 0 ? `${Math.round(ttl / 1000)}s` : 'Expired'}`);
        
        // Ask if should clear
        if (ttl > 0) {
          console.log(`    ⚠️  Lock is still active`);
        } else {
          console.log(`    🗑️  Lock expired, can be cleared`);
        }
        console.log('');
      } else {
        console.log(`  Meeting ${meetingId}: No lock found\n`);
      }
    }

    console.log('💡 To clear locks, use: redis-cli DEL lock:meeting:<meetingId>');
    console.log('   Or restart Redis to clear all locks\n');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await redis.quit();
  }
}

const meetingIds = process.argv.slice(2);
if (meetingIds.length === 0) {
  console.error('Usage: npx tsx scripts/check-and-clear-locks.ts <meetingId1> <meetingId2> ...');
  process.exit(1);
}

checkAndClearLocks(meetingIds).then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});








