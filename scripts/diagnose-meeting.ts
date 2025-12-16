/**
 * Script to diagnose meeting processing issues
 * Usage: npx tsx scripts/diagnose-meeting.ts <meetingId>
 */

import { PrismaClient } from '@prisma/client';
import { generatePresignedReadUrl } from '@/lib/orchestrator/s3-utils';
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getProcessingQueue } from '@/lib/orchestrator/queue';
import { validateMeetingId } from '@/lib/meeting/validation';

const prisma = new PrismaClient();

function getS3Client(): S3Client {
  const endpoint = process.env.S3_ENDPOINT;
  const region = process.env.S3_REGION || 'us-east-1';
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error('S3 configuration is missing');
  }

  return new S3Client({
    endpoint,
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    forcePathStyle: true,
  });
}

async function diagnoseMeeting(meetingId: string) {
  console.log(`\n🔍 Diagnosing meeting: ${meetingId}\n`);

  // Validate meeting ID format
  const idValidation = validateMeetingId(meetingId);
  if (!idValidation.valid) {
    console.error(`❌ Invalid meeting ID format: ${idValidation.error?.message || 'Unknown error'}`);
    console.error(`   Expected format: met{N} (e.g., met1, met42)`);
    process.exit(1);
  }

  try {
    // Check environment variables
    console.log('📋 Environment Check:');
    console.log(`   DEEPGRAM_API_KEY: ${process.env.DEEPGRAM_API_KEY ? '✅ Set' : '❌ Missing'}`);
    console.log(`   S3_ENDPOINT: ${process.env.S3_ENDPOINT || '❌ Missing'}`);
    console.log(`   S3_BUCKET_NAME: ${process.env.S3_BUCKET_NAME || '❌ Missing'}`);
    console.log(`   S3_ACCESS_KEY_ID: ${process.env.S3_ACCESS_KEY_ID ? '✅ Set' : '❌ Missing'}`);

    // Get meeting data
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        uploadBlob: true,
      },
    });

    if (!meeting) {
      console.log('❌ Meeting not found');
      return;
    }

    if (!meeting.uploadBlob) {
      console.log('❌ UploadBlob not found');
      return;
    }

    console.log('\n📊 Meeting Status:');
    console.log(`   Status: ${meeting.status}`);
    console.log(`   Created At: ${meeting.createdAt.toISOString()}`);
    if (meeting.validatedAt) {
      console.log(`   Validated At: ${meeting.validatedAt.toISOString()}`);
    }

    console.log('\n📁 File Information:');
    console.log(`   Storage Path: ${meeting.uploadBlob.storagePath}`);
    console.log(`   Size: ${(Number(meeting.uploadBlob.sizeBytes) / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   MIME Type: ${meeting.uploadBlob.mimeType}`);
    console.log(`   Original Filename: ${meeting.uploadBlob.originalFilename}`);
    if (meeting.uploadBlob.expiresAt) {
      console.log(`   Expires At: ${meeting.uploadBlob.expiresAt.toISOString()}`);
    }
    if (meeting.uploadBlob.deletedAt) {
      console.log(`   ⚠️  Deleted At: ${meeting.uploadBlob.deletedAt.toISOString()}`);
    }

    // Check transcript and artifacts
    const transcript = await prisma.transcript.findUnique({
      where: { meetingId },
      select: { id: true, createdAt: true },
    });
    const artifacts = await prisma.artifacts.findUnique({
      where: { meetingId },
      select: { id: true, createdAt: true },
    });

    console.log('\n📝 Processing Results:');
    console.log(`   Transcript: ${transcript ? `✅ Created at ${transcript.createdAt.toISOString()}` : '❌ Not found'}`);
    console.log(`   Artifacts: ${artifacts ? `✅ Created at ${artifacts.createdAt.toISOString()}` : '❌ Not found'}`);

    // Check BullMQ jobs
    console.log('\n🔧 BullMQ Job Information:');
    try {
      const queue = getProcessingQueue();
      const jobId = `process-meeting-${meetingId}`;
      const job = await queue.getJob(jobId);
      
      if (job) {
        const state = await job.getState();
        console.log(`   Job ID: ${job.id}`);
        console.log(`   State: ${state}`);
        console.log(`   Attempts Made: ${job.attemptsMade}`);
        console.log(`   Created At: ${new Date(job.timestamp).toISOString()}`);
        
        if (job.processedOn) {
          console.log(`   Processed At: ${new Date(job.processedOn).toISOString()}`);
        }
        if (job.finishedOn) {
          console.log(`   Finished At: ${new Date(job.finishedOn).toISOString()}`);
        }
        if (job.failedReason) {
          console.log(`   ❌ Failure Reason: ${job.failedReason}`);
        }
        if (job.returnvalue) {
          console.log(`   Return Value: ${JSON.stringify(job.returnvalue, null, 2)}`);
        }
        
        // Get job logs if available
        const logs = await job.getState();
        console.log(`   Current State: ${logs}`);
      } else {
        console.log(`   ⚠️  Job not found with ID: ${jobId}`);
        console.log(`   This might mean the job was already processed and removed.`);
        
        // Try to find failed jobs
        const failedJobs = await queue.getFailed();
        const relatedFailedJob = failedJobs.find(j => j.data.meetingId === meetingId);
        if (relatedFailedJob) {
          console.log(`   ❌ Found failed job: ${relatedFailedJob.id}`);
          console.log(`   Failed Reason: ${relatedFailedJob.failedReason}`);
          console.log(`   Failed At: ${relatedFailedJob.finishedOn ? new Date(relatedFailedJob.finishedOn).toISOString() : 'Unknown'}`);
        }
      }
    } catch (error: any) {
      console.log(`   ⚠️  Error checking BullMQ jobs: ${error.message}`);
    }

    // Check if file exists in S3
    console.log('\n🔍 S3 File Check:');
    try {
      const s3Client = getS3Client();
      const bucketName = process.env.S3_BUCKET_NAME;
      
      if (!bucketName) {
        console.log('   ❌ S3_BUCKET_NAME not set');
        return;
      }

      const command = new HeadObjectCommand({
        Bucket: bucketName,
        Key: meeting.uploadBlob.storagePath,
      });

      try {
        const response = await s3Client.send(command);
        console.log('   ✅ File exists in S3');
        console.log(`   Content Length: ${response.ContentLength ? (Number(response.ContentLength) / 1024 / 1024).toFixed(2) + ' MB' : 'Unknown'}`);
        console.log(`   Content Type: ${response.ContentType || 'Unknown'}`);
      } catch (error: any) {
        if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
          console.log('   ❌ File NOT FOUND in S3');
        } else {
          console.log(`   ❌ Error checking file: ${error.message}`);
          console.log(`   Error code: ${error.name || 'Unknown'}`);
        }
        return;
      }

      // Try to generate presigned URL
      console.log('\n🔗 Presigned URL Check:');
      try {
        const presignedUrl = await generatePresignedReadUrl(meeting.uploadBlob.storagePath);
        console.log('   ✅ Presigned URL generated successfully');
        console.log(`   URL (first 100 chars): ${presignedUrl.substring(0, 100)}...`);
        
        // Check if URL is accessible
        try {
          const response = await fetch(presignedUrl, { method: 'HEAD' });
          if (response.ok) {
            console.log(`   ✅ URL is accessible (Status: ${response.status})`);
          } else {
            console.log(`   ⚠️  URL returned status ${response.status}`);
          }
        } catch (error: any) {
          console.log(`   ⚠️  URL check failed: ${error.message}`);
        }
      } catch (error: any) {
        console.log(`   ❌ Failed to generate presigned URL: ${error.message}`);
      }

    } catch (error: any) {
      console.log(`   ❌ S3 connection error: ${error.message}`);
    }

    // Check Deepgram API key
    console.log('\n🎤 Deepgram API Check:');
    const deepgramKey = process.env.DEEPGRAM_API_KEY;
    if (!deepgramKey) {
      console.log('   ❌ DEEPGRAM_API_KEY not set');
    } else {
      const trimmedKey = deepgramKey.trim();
      const hasWhitespace = trimmedKey !== deepgramKey || /\s/.test(trimmedKey);
      console.log(`   ✅ DEEPGRAM_API_KEY is set (length: ${deepgramKey.length}, trimmed: ${trimmedKey.length})`);
      if (hasWhitespace) {
        console.log('   ⚠️  Key contains whitespace - this may cause authentication issues');
      }
      
      // Try to validate the key
      try {
        const { createClient } = await import('@deepgram/sdk');
        const deepgram = createClient(trimmedKey);
        const { result, error } = await deepgram.manage.getProjects();
        if (error) {
          console.log(`   ❌ API key validation failed: ${error.message || 'Unknown error'}`);
          console.log(`   Error code: ${(error as any).code || 'Unknown'}`);
        } else {
          console.log('   ✅ API key is valid');
        }
      } catch (err: any) {
        console.log(`   ⚠️  Could not validate key: ${err.message}`);
      }
    }

    // Additional diagnostics for Failed_Transcription status
    if (meeting.status === 'Failed_Transcription') {
      console.log('\n🔴 Transcription Failure Analysis:');
      console.log('   Possible causes:');
      console.log('   1. S3 download error - file not accessible or corrupted');
      console.log('   2. Deepgram API error - invalid API key, rate limit, or file format issue');
      console.log('   3. File format not supported by Deepgram');
      console.log('   4. Network timeout during transcription');
      console.log('\n   💡 Check the worker logs for detailed error messages:');
      console.log('      - Look for "[Transcription]" or "[S3]" log entries');
      console.log('      - Check for Deepgram API error responses');
      console.log('      - Verify file exists in S3 and is accessible');
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

const meetingId = process.argv[2];
if (!meetingId) {
  console.error('Usage: npx tsx scripts/diagnose-meeting.ts <meetingId>');
  process.exit(1);
}

diagnoseMeeting(meetingId);

