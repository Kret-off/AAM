/**
 * Script to retry processing for meetings by title
 * Usage: npx tsx scripts/retry-meetings-by-title.ts "3" "2"
 */

import { prisma } from '../lib/prisma';
import { enqueueProcessingJob } from '../lib/orchestrator/queue';

async function retryMeetingsByTitle(titles: string[]) {
  console.log(`\n🔍 Searching for meetings with titles: ${titles.join(', ')}\n`);

  try {
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

    console.log('🔄 Enqueueing processing jobs...\n');

    for (const meeting of meetings) {
      try {
        await enqueueProcessingJob(meeting.id);
        console.log(`✅ Job enqueued successfully for meeting ${meeting.id} (title: "${meeting.title}")`);
      } catch (error) {
        console.error(`❌ Error enqueueing job for meeting ${meeting.id}:`, error);
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
  console.error('Usage: npx tsx scripts/retry-meetings-by-title.ts <title1> <title2> ...');
  console.error('Example: npx tsx scripts/retry-meetings-by-title.ts "3" "2"');
  process.exit(1);
}

retryMeetingsByTitle(titles).then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});








