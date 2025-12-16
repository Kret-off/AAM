/**
 * Script to check queue status and meeting processing state
 */

import { prisma } from '../lib/prisma';
import { getProcessingQueue } from '../lib/orchestrator/queue';

async function checkQueueStatus() {
  try {
    const queue = getProcessingQueue();
    
    // Get queue stats
    const waiting = await queue.getWaitingCount();
    const active = await queue.getActiveCount();
    const completed = await queue.getCompletedCount();
    const failed = await queue.getFailedCount();
    
    console.log('\n📊 Queue Status:');
    console.log(`  Waiting: ${waiting}`);
    console.log(`  Active: ${active}`);
    console.log(`  Completed: ${completed}`);
    console.log(`  Failed: ${failed}\n`);

    // Get waiting jobs
    if (waiting > 0) {
      const waitingJobs = await queue.getWaiting(0, 10);
      console.log('⏳ Waiting Jobs:');
      waitingJobs.forEach((job) => {
        console.log(`  - Job ID: ${job.id}, Meeting ID: ${job.data.meetingId}`);
      });
      console.log('');
    }

    // Get active jobs
    if (active > 0) {
      const activeJobs = await queue.getActive(0, 10);
      console.log('🔄 Active Jobs:');
      activeJobs.forEach((job) => {
        console.log(`  - Job ID: ${job.id}, Meeting ID: ${job.data.meetingId}`);
      });
      console.log('');
    }

    // Check meetings with titles "3" and "2"
    const meetings = await prisma.meeting.findMany({
      where: {
        title: {
          in: ['3', '2'],
        },
      },
      select: {
        id: true,
        title: true,
        status: true,
        transcript: {
          select: {
            id: true,
          },
        },
        artifacts: {
          select: {
            id: true,
          },
        },
      },
    });

    console.log('📋 Meeting Status:');
    meetings.forEach((meeting) => {
      console.log(`  - Meeting "${meeting.title}" (${meeting.id}):`);
      console.log(`    Status: ${meeting.status}`);
      console.log(`    Has Transcript: ${meeting.transcript ? 'Yes' : 'No'}`);
      console.log(`    Has Artifacts: ${meeting.artifacts ? 'Yes' : 'No'}`);
      
      // Check if job exists in queue
      const jobId = `process-meeting-${meeting.id}`;
      queue.getJob(jobId).then((job) => {
        if (job) {
          console.log(`    Queue Job: ${job.id} (${job.state})`);
        } else {
          console.log(`    Queue Job: Not found`);
        }
      }).catch(() => {
        console.log(`    Queue Job: Error checking`);
      });
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

checkQueueStatus().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
