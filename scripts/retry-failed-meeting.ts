/**
 * Script to retry processing a failed meeting
 * Usage: npx tsx scripts/retry-failed-meeting.ts <meetingId>
 */

import { PrismaClient, MeetingStatus } from '@prisma/client';
import { getProcessingQueue } from '@/lib/orchestrator/queue';
import { validateMeetingId } from '@/lib/meeting/validation';

const prisma = new PrismaClient();

async function retryFailedMeeting(meetingId: string) {
  console.log(`\n🔄 Retrying processing for meeting: ${meetingId}\n`);

  // Validate meeting ID format
  const idValidation = validateMeetingId(meetingId);
  if (!idValidation.valid) {
    console.error(`❌ Invalid meeting ID format: ${idValidation.error?.message || 'Unknown error'}`);
    console.error(`   Expected format: met{N} (e.g., met1, met42)`);
    process.exit(1);
  }

  try {
    // Get meeting
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        uploadBlob: true,
        transcript: true,
        artifacts: true,
      },
    });

    if (!meeting) {
      console.log('❌ Meeting not found');
      return;
    }

    console.log('📊 Current Status:');
    console.log(`   Status: ${meeting.status}`);
    console.log(`   Has Transcript: ${meeting.transcript ? '✅ Yes' : '❌ No'}`);
    console.log(`   Has Artifacts: ${meeting.artifacts ? '✅ Yes' : '❌ No'}`);
    console.log();

    // Check if meeting is in a failed state
    const failedStatuses: MeetingStatus[] = [
      'Failed_Transcription',
      'Failed_LLM',
      'Failed_System',
    ];

    if (!failedStatuses.includes(meeting.status as MeetingStatus)) {
      console.log(`⚠️  Meeting is not in a failed state (current: ${meeting.status})`);
      console.log('   Only failed meetings can be retried');
      return;
    }

    // Check if upload blob exists
    if (!meeting.uploadBlob) {
      console.log('❌ UploadBlob not found. Cannot retry processing.');
      return;
    }

    // Check if upload blob is expired or deleted
    if (meeting.uploadBlob.deletedAt) {
      console.log('❌ UploadBlob has been deleted. Cannot retry processing.');
      console.log(`   Deleted at: ${meeting.uploadBlob.deletedAt.toISOString()}`);
      return;
    }

    if (meeting.uploadBlob.expiresAt && meeting.uploadBlob.expiresAt < new Date()) {
      console.log('⚠️  UploadBlob has expired.');
      console.log(`   Expires at: ${meeting.uploadBlob.expiresAt.toISOString()}`);
      console.log('   File may be deleted soon. Proceeding anyway...');
    }

    // Ask for confirmation
    console.log('⚠️  This will:');
    console.log('   1. Reset meeting status to Uploaded');
    if (meeting.transcript) {
      console.log('   2. Delete existing transcript');
    }
    if (meeting.artifacts) {
      console.log('   3. Delete existing artifacts');
    }
    console.log('   4. Enqueue processing job');
    console.log();

    // Reset status to Uploaded
    console.log('🔄 Resetting meeting status to Uploaded...');
    await prisma.meeting.update({
      where: { id: meetingId },
      data: {
        status: 'Uploaded',
      },
    });
    console.log('   ✅ Status reset to Uploaded');

    // Delete existing transcript if exists
    if (meeting.transcript) {
      console.log('🗑️  Deleting existing transcript...');
      await prisma.transcript.delete({
        where: { meetingId },
      });
      console.log('   ✅ Transcript deleted');
    }

    // Delete existing artifacts if exists
    if (meeting.artifacts) {
      console.log('🗑️  Deleting existing artifacts...');
      await prisma.artifacts.delete({
        where: { meetingId },
      });
      console.log('   ✅ Artifacts deleted');
    }

    // Clear expires_at from upload blob to prevent deletion
    if (meeting.uploadBlob.expiresAt) {
      console.log('🔄 Clearing expiration from upload blob...');
      await prisma.uploadBlob.update({
        where: { meetingId },
        data: {
          expiresAt: null,
        },
      });
      console.log('   ✅ Expiration cleared');
    }

    // Enqueue processing job
    console.log('📤 Enqueueing processing job...');
    const queue = getProcessingQueue();
    await queue.add(
      'process-meeting',
      { meetingId },
      {
        jobId: `process-meeting-${meetingId}`,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      }
    );
    console.log('   ✅ Processing job enqueued');

    console.log('\n✅ Meeting reset and processing job enqueued successfully!');
    console.log('   The worker will process the meeting automatically.');
    console.log('   Check the meeting status in a few minutes.');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error('   Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

const meetingId = process.argv[2];
if (!meetingId) {
  console.error('Usage: npx tsx scripts/retry-failed-meeting.ts <meetingId>');
  process.exit(1);
}

retryFailedMeeting(meetingId);





