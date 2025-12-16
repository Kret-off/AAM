/**
 * Script to delete a meeting and all related data including temporary files and client
 * Usage: npx tsx scripts/delete-meeting.ts <meetingId>
 */

import { PrismaClient } from '@prisma/client';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { validateMeetingId } from '../lib/meeting/validation';

const prisma = new PrismaClient();

/**
 * Get S3 client instance
 */
function getS3Client(): S3Client {
  const endpoint = process.env.S3_ENDPOINT;
  const region = process.env.S3_REGION || 'us-east-1';
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error('S3 configuration is missing. Please check environment variables.');
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

/**
 * Delete file from S3
 */
async function deleteFileFromS3(storagePath: string): Promise<void> {
  try {
    const s3Client = getS3Client();
    const bucketName = process.env.S3_BUCKET_NAME;

    if (!bucketName) {
      throw new Error('S3_BUCKET_NAME environment variable is not set');
    }

    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: storagePath,
      })
    );
    console.log(`   ✅ File deleted from S3: ${storagePath}`);
  } catch (error) {
    console.error(`   ⚠️  Failed to delete file from S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
    // Continue with DB cleanup even if S3 deletion fails
  }
}

async function deleteMeeting(meetingId: string) {
  console.log(`\n🗑️  Deleting meeting: ${meetingId}\n`);

  // Validate meeting ID format
  const idValidation = validateMeetingId(meetingId);
  if (!idValidation.valid) {
    console.error(`❌ Invalid meeting ID format: ${idValidation.error?.message || 'Unknown error'}`);
    console.error(`   Expected format: met{N} (e.g., met1, met42)`);
    process.exit(1);
  }

  try {
    // Step 1: Find meeting with all relations
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        uploadBlob: true,
        transcript: true,
        artifacts: true,
        validation: true,
        participants: true,
        viewers: true,
        processingErrors: true,
        llmInteractions: true,
        client: {
          include: {
            meetings: {
              select: { id: true },
            },
          },
        },
      },
    });

    if (!meeting) {
      console.log('❌ Meeting not found');
      return;
    }

    console.log('📊 Meeting Information:');
    console.log(`   ID: ${meeting.id}`);
    console.log(`   Status: ${meeting.status}`);
    console.log(`   Title: ${meeting.title || '(no title)'}`);
    console.log(`   Client ID: ${meeting.clientId}`);
    console.log(`   Client Name: ${meeting.client.name}`);
    console.log(`   Created: ${meeting.createdAt.toISOString()}`);

    // Count related records
    console.log('\n📋 Related Records:');
    console.log(`   UploadBlob: ${meeting.uploadBlob ? '✅' : '❌'}`);
    console.log(`   Transcript: ${meeting.transcript ? '✅' : '❌'}`);
    console.log(`   Artifacts: ${meeting.artifacts ? '✅' : '❌'}`);
    console.log(`   Validation: ${meeting.validation ? '✅' : '❌'}`);
    console.log(`   Participants: ${meeting.participants.length}`);
    console.log(`   Viewers: ${meeting.viewers.length}`);
    console.log(`   Processing Errors: ${meeting.processingErrors.length}`);
    console.log(`   LLM Interactions: ${meeting.llmInteractions.length}`);

    // Check if client has other meetings
    const otherMeetings = meeting.client.meetings.filter((m) => m.id !== meetingId);
    const shouldDeleteClient = otherMeetings.length === 0;

    console.log(`\n   Client has ${otherMeetings.length} other meeting(s)`);
    if (shouldDeleteClient) {
      console.log('   ⚠️  Client will be deleted (no other meetings)');
    }

    // Step 2: Delete file from S3 if UploadBlob exists
    if (meeting.uploadBlob && !meeting.uploadBlob.deletedAt) {
      console.log('\n🗂️  Deleting file from S3...');
      await deleteFileFromS3(meeting.uploadBlob.storagePath);
    } else if (meeting.uploadBlob?.deletedAt) {
      console.log('\n🗂️  File already deleted from S3');
    } else {
      console.log('\n🗂️  No UploadBlob found');
    }

    // Step 3: Delete meeting (cascade will delete related records)
    console.log('\n🗑️  Deleting meeting and related records...');
    await prisma.meeting.delete({
      where: { id: meetingId },
    });
    console.log('   ✅ Meeting deleted');

    // Step 4: Delete client if it has no other meetings
    if (shouldDeleteClient) {
      console.log('\n🗑️  Deleting client...');
      await prisma.client.delete({
        where: { id: meeting.clientId },
      });
      console.log(`   ✅ Client "${meeting.client.name}" deleted`);
    } else {
      console.log(`\n📌 Client "${meeting.client.name}" kept (has other meetings)`);
    }

    console.log('\n✅ Deletion completed successfully!');
  } catch (error) {
    console.error('\n❌ Error during deletion:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack);
    }
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

const meetingId = process.argv[2];
if (!meetingId) {
  console.error('Usage: npx tsx scripts/delete-meeting.ts <meetingId>');
  process.exit(1);
}

deleteMeeting(meetingId).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});


