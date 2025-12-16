/**
 * Script to manually retry processing a meeting
 * Usage: npx tsx scripts/retry-meeting.ts <meetingId>
 */

import { enqueueProcessingJob } from '@/lib/orchestrator/queue';
import { validateMeetingId } from '@/lib/meeting/validation';

async function retryMeeting(meetingId: string) {
  console.log(`\n🔄 Retrying processing for meeting: ${meetingId}\n`);

  // Validate meeting ID format
  const idValidation = validateMeetingId(meetingId);
  if (!idValidation.valid) {
    console.error(`❌ Invalid meeting ID format: ${idValidation.error?.message || 'Unknown error'}`);
    console.error(`   Expected format: met{N} (e.g., met1, met42)`);
    process.exit(1);
  }

  try {
    await enqueueProcessingJob(meetingId);
    console.log(`✅ Job enqueued successfully for meeting ${meetingId}`);
    console.log(`\n⚠️  Make sure the worker is running: npm run worker`);
  } catch (error) {
    console.error('❌ Error enqueueing job:', error);
  }
}

const meetingId = process.argv[2];
if (!meetingId) {
  console.error('Usage: npx tsx scripts/retry-meeting.ts <meetingId>');
  process.exit(1);
}

retryMeeting(meetingId).then(() => {
  process.exit(0);
});





