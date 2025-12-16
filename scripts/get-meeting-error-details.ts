/**
 * Script to get detailed error information for a failed meeting
 * Usage: npx tsx scripts/get-meeting-error-details.ts <meetingId>
 */

import { getProcessingQueue } from '@/lib/orchestrator/queue';
import { PrismaClient } from '@prisma/client';
import { validateMeetingId } from '@/lib/meeting/validation';

const prisma = new PrismaClient();

async function getErrorDetails(meetingId: string) {
  console.log(`\n🔍 Getting error details for meeting: ${meetingId}\n`);

  // Validate meeting ID format
  const idValidation = validateMeetingId(meetingId);
  if (!idValidation.valid) {
    console.error(`❌ Invalid meeting ID format: ${idValidation.error?.message || 'Unknown error'}`);
    console.error(`   Expected format: met{N} (e.g., met1, met42)`);
    process.exit(1);
  }

  try {
    const queue = getProcessingQueue();
    const jobId = `process-meeting-${meetingId}`;
    const job = await queue.getJob(jobId);

    if (!job) {
      console.log('❌ Job not found. Checking failed jobs...');
      const failedJobs = await queue.getFailed();
      const relatedFailedJob = failedJobs.find(j => j.data.meetingId === meetingId);
      
      if (relatedFailedJob) {
        console.log(`\n📋 Failed Job Details:`);
        console.log(`   Job ID: ${relatedFailedJob.id}`);
        console.log(`   Failed Reason: ${relatedFailedJob.failedReason}`);
        console.log(`   Stack Trace: ${relatedFailedJob.stacktrace || 'No stack trace available'}`);
        console.log(`   Failed At: ${relatedFailedJob.finishedOn ? new Date(relatedFailedJob.finishedOn).toISOString() : 'Unknown'}`);
        console.log(`   Attempts Made: ${relatedFailedJob.attemptsMade}`);
        console.log(`   Return Value: ${JSON.stringify(relatedFailedJob.returnvalue, null, 2)}`);
      } else {
        console.log('❌ No failed job found for this meeting');
      }
      return;
    }

    console.log(`\n📋 Job Details:`);
    console.log(`   Job ID: ${job.id}`);
    console.log(`   State: ${await job.getState()}`);
    console.log(`   Attempts Made: ${job.attemptsMade}`);
    console.log(`   Created At: ${new Date(job.timestamp).toISOString()}`);
    
    if (job.processedOn) {
      console.log(`   Processed At: ${new Date(job.processedOn).toISOString()}`);
    }
    if (job.finishedOn) {
      console.log(`   Finished At: ${new Date(job.finishedOn).toISOString()}`);
    }
    
    if (job.failedReason) {
      console.log(`\n❌ Failure Information:`);
      console.log(`   Reason: ${job.failedReason}`);
      console.log(`   Stack Trace: ${job.stacktrace || 'No stack trace available'}`);
    }
    
    if (job.returnvalue) {
      console.log(`\n📤 Return Value:`);
      console.log(JSON.stringify(job.returnvalue, null, 2));
    }

    // Get job logs if available
    try {
      const logs = await job.getState();
      console.log(`\n📊 Current State: ${logs}`);
    } catch (error: any) {
      console.log(`\n⚠️  Could not get job state: ${error.message}`);
    }

    // Check meeting status
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      select: {
        id: true,
        status: true,
        createdAt: true,
        uploadBlob: {
          select: {
            storagePath: true,
            mimeType: true,
            sizeBytes: true,
            originalFilename: true,
          },
        },
      },
    });

    if (meeting) {
      console.log(`\n📊 Meeting Status:`);
      console.log(`   Status: ${meeting.status}`);
      console.log(`   Created At: ${meeting.createdAt.toISOString()}`);
      if (meeting.uploadBlob) {
        console.log(`   File: ${meeting.uploadBlob.originalFilename}`);
        console.log(`   Size: ${(Number(meeting.uploadBlob.sizeBytes) / 1024 / 1024).toFixed(2)} MB`);
        console.log(`   MIME Type: ${meeting.uploadBlob.mimeType}`);
      }
    }

    // Check for transcript
    const transcript = await prisma.transcript.findUnique({
      where: { meetingId },
      select: { id: true },
    });
    console.log(`   Transcript: ${transcript ? '✅ Exists' : '❌ Not found'}`);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

const meetingId = process.argv[2];
if (!meetingId) {
  console.error('Usage: npx tsx scripts/get-meeting-error-details.ts <meetingId>');
  process.exit(1);
}

getErrorDetails(meetingId);





