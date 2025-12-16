/**
 * Script to check recent completed jobs and their results
 */

import { getProcessingQueue } from '../lib/orchestrator/queue';

async function checkRecentJobs() {
  try {
    const queue = getProcessingQueue();
    
    // Get recent completed jobs
    const completedJobs = await queue.getCompleted(0, 20);
    
    console.log(`\n📋 Recent Completed Jobs (${completedJobs.length}):\n`);
    
    for (const job of completedJobs) {
      const meetingId = job.data?.meetingId;
      console.log(`Job ID: ${job.id}`);
      console.log(`  Meeting ID: ${meetingId}`);
      console.log(`  Completed At: ${job.finishedOn ? new Date(job.finishedOn).toISOString() : 'N/A'}`);
      console.log(`  Processed Duration: ${job.processedOn && job.finishedOn ? (job.finishedOn - job.processedOn) / 1000 : 'N/A'}s`);
      
      // Check if this is one of our target meetings
      if (meetingId === '2a691c11-aca0-4faf-b377-cc0758216b94' || 
          meetingId === 'b95b88d8-a8c8-47c9-beb5-c96b2a844dc9') {
        console.log(`  ⚠️  This is one of the target meetings!`);
      }
      console.log('');
    }

    // Get failed jobs
    const failedJobs = await queue.getFailed(0, 20);
    if (failedJobs.length > 0) {
      console.log(`\n❌ Failed Jobs (${failedJobs.length}):\n`);
      for (const job of failedJobs) {
        const meetingId = job.data?.meetingId;
        console.log(`Job ID: ${job.id}`);
        console.log(`  Meeting ID: ${meetingId}`);
        console.log(`  Failed At: ${job.finishedOn ? new Date(job.finishedOn).toISOString() : 'N/A'}`);
        if (job.failedReason) {
          console.log(`  Reason: ${job.failedReason}`);
        }
        console.log('');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

checkRecentJobs().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});








