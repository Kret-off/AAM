/**
 * Script to force retry processing for meetings by removing old jobs and creating new ones
 */

import { prisma } from '../lib/prisma';
import { getProcessingQueue } from '../lib/orchestrator/queue';

async function forceRetryMeetingsByTitle(titles: string[]) {
  console.log(`\n🔍 Searching for meetings with titles: ${titles.join(', ')}\n`);

  try {
    const queue = getProcessingQueue();

    // Find meetings with specified titles
    const meetings = await prisma.meeting.findMany({
      where: {
        title: {
          in: titles,
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

    if (meetings.length === 0) {
      console.log('❌ No meetings found with the specified titles');
      return;
    }

    console.log(`✅ Found ${meetings.length} meeting(s):\n`);
    meetings.forEach((meeting) => {
      console.log(`  - Meeting ID: ${meeting.id}`);
      console.log(`    Title: ${meeting.title}`);
      console.log(`    Status: ${meeting.status}`);
      console.log(`    Has Transcript: ${meeting.transcript ? 'Yes' : 'No'}`);
      console.log(`    Has Artifacts: ${meeting.artifacts ? 'Yes' : 'No'}`);
      console.log('');
    });

    console.log('🔄 Removing old jobs and enqueueing new ones...\n');

    for (const meeting of meetings) {
      try {
        const jobId = `process-meeting-${meeting.id}`;
        
        // Try to get existing job
        const existingJob = await queue.getJob(jobId);
        if (existingJob) {
          console.log(`  Removing old job ${jobId} (state: ${await existingJob.getState()})`);
          await existingJob.remove();
        }

        // Create new job with timestamp to ensure uniqueness
        const newJobId = `process-meeting-${meeting.id}-${Date.now()}`;
        await queue.add(
          'process-meeting',
          { meetingId: meeting.id },
          {
            jobId: newJobId,
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 2000,
            },
          }
        );
        console.log(`✅ New job enqueued: ${newJobId} for meeting ${meeting.id} (title: "${meeting.title}")`);
      } catch (error) {
        console.error(`❌ Error processing meeting ${meeting.id}:`, error);
      }
    }

    console.log(`\n⚠️  Make sure the worker is running: npm run worker`);
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

const titles = process.argv.slice(2);
if (titles.length === 0) {
  console.error('Usage: npx tsx scripts/force-retry-meetings.ts <title1> <title2> ...');
  console.error('Example: npx tsx scripts/force-retry-meetings.ts "3" "2"');
  process.exit(1);
}

forceRetryMeetingsByTitle(titles).then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});








