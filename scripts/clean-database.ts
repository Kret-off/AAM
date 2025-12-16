/**
 * Script to clean all test data from database
 * Deletes: Clients, Meetings, and all meeting-related entities
 * Keeps: Users, MeetingTypes, PromptScenarios, DirectoryParticipants
 * Also deletes all files from S3/MinIO storage
 * 
 * Usage: npx tsx scripts/clean-database.ts [--confirm]
 * 
 * WARNING: This will delete ALL clients, meetings, and related data!
 */

import { PrismaClient } from '@prisma/client';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';

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
    forcePathStyle: true, // Required for MinIO compatibility
  });
}

/**
 * Get statistics before/after cleanup
 */
async function getStatistics() {
  try {
    async function safeCount(model: any, name: string): Promise<number> {
      try {
        if (!model || typeof model.count !== 'function') {
          console.warn(`⚠️  Model ${name} is not available`);
          return 0;
        }
        const result = await model.count();
        return typeof result === 'number' ? result : 0;
      } catch (error) {
        console.warn(`⚠️  Error counting ${name}:`, error);
        return 0;
      }
    }

    const clientCount = await safeCount(prisma.client, 'client');
    const meetingCount = await safeCount(prisma.meeting, 'meeting');
    const meetingParticipantCount = await safeCount(prisma.meetingParticipant, 'meetingParticipant');
    const meetingViewerCount = await safeCount(prisma.meetingViewer, 'meetingViewer');
    const uploadBlobCount = await safeCount(prisma.uploadBlob, 'uploadBlob');
    const transcriptCount = await safeCount(prisma.transcript, 'transcript');
    const artifactsCount = await safeCount(prisma.artifacts, 'artifacts');
    const validationCount = await safeCount(prisma.validation, 'validation');
    const processingErrorCount = await safeCount(prisma.processingError, 'processingError');
    
    // LLMInteraction model - try to access safely
    let llmInteractionCount = 0;
    try {
      const llmModel = (prisma as any).lLMInteraction || (prisma as any).llmInteraction;
      if (llmModel) {
        llmInteractionCount = await safeCount(llmModel, 'LLMInteraction');
      }
    } catch (e) {
      // Model might not exist or be accessible - cascade delete will handle it
      llmInteractionCount = 0;
    }

    // Data that should remain
    const userCount = await safeCount(prisma.user, 'user');
    const meetingTypeCount = await safeCount(prisma.meetingType, 'meetingType');
    const scenarioCount = await safeCount(prisma.promptScenario, 'promptScenario');
    const participantCount = await safeCount(prisma.directoryParticipant, 'directoryParticipant');

    return {
      // To be deleted
      clientCount,
      meetingCount,
      meetingParticipantCount,
      meetingViewerCount,
      uploadBlobCount,
      transcriptCount,
      artifactsCount,
      validationCount,
      processingErrorCount,
      llmInteractionCount,
      // To be kept
      userCount,
      meetingTypeCount,
      scenarioCount,
      participantCount,
    };
  } catch (error) {
    console.error('Error getting statistics:', error);
    throw error;
  }
}

/**
 * Delete all files from S3/MinIO storage
 */
async function deleteFilesFromS3(): Promise<{ deleted: number; errors: number }> {
  let deleted = 0;
  let errors = 0;

  try {
    // Get all UploadBlob records before deletion
    const uploadBlobs = await prisma.uploadBlob.findMany({
      select: {
        id: true,
        storagePath: true,
        deletedAt: true,
      },
    });

    if (uploadBlobs.length === 0) {
      console.log('   No files to delete from S3');
      return { deleted: 0, errors: 0 };
    }

    const s3Client = getS3Client();
    const bucketName = process.env.S3_BUCKET_NAME;

    if (!bucketName) {
      console.warn('⚠️  S3_BUCKET_NAME not set, skipping file deletion');
      return { deleted: 0, errors: uploadBlobs.length };
    }

    console.log(`   Found ${uploadBlobs.length} file(s) to delete from S3`);

    for (const blob of uploadBlobs) {
      // Skip if already marked as deleted
      if (blob.deletedAt) {
        continue;
      }

      try {
        await s3Client.send(
          new DeleteObjectCommand({
            Bucket: bucketName,
            Key: blob.storagePath,
          })
        );
        deleted++;
      } catch (error) {
        console.error(`   ⚠️  Failed to delete file ${blob.storagePath}:`, error);
        errors++;
      }
    }

    return { deleted, errors };
  } catch (error) {
    console.error('❌ Error deleting files from S3:', error);
    return { deleted, errors: errors + 1 };
  }
}

/**
 * Main cleanup function
 */
async function cleanDatabase() {
  console.log('\n🧹 Starting database cleanup...\n');

  try {
    // Get statistics before deletion
    console.log('📊 Statistics BEFORE cleanup:');
    const statsBefore = await getStatistics();
    console.log('\n   To be DELETED:');
    console.log(`      Clients: ${statsBefore.clientCount}`);
    console.log(`      Meetings: ${statsBefore.meetingCount}`);
    console.log(`      MeetingParticipants: ${statsBefore.meetingParticipantCount}`);
    console.log(`      MeetingViewers: ${statsBefore.meetingViewerCount}`);
    console.log(`      UploadBlobs: ${statsBefore.uploadBlobCount}`);
    console.log(`      Transcripts: ${statsBefore.transcriptCount}`);
    console.log(`      Artifacts: ${statsBefore.artifactsCount}`);
    console.log(`      Validations: ${statsBefore.validationCount}`);
    console.log(`      ProcessingErrors: ${statsBefore.processingErrorCount}`);
    console.log(`      LLMInteractions: ${statsBefore.llmInteractionCount}`);
    console.log('\n   To be KEPT:');
    console.log(`      Users: ${statsBefore.userCount}`);
    console.log(`      MeetingTypes: ${statsBefore.meetingTypeCount}`);
    console.log(`      PromptScenarios: ${statsBefore.scenarioCount}`);
    console.log(`      DirectoryParticipants: ${statsBefore.participantCount}`);

    const totalToDelete = 
      statsBefore.clientCount +
      statsBefore.meetingCount +
      statsBefore.meetingParticipantCount +
      statsBefore.meetingViewerCount +
      statsBefore.uploadBlobCount +
      statsBefore.transcriptCount +
      statsBefore.artifactsCount +
      statsBefore.validationCount +
      statsBefore.processingErrorCount +
      statsBefore.llmInteractionCount;

    if (totalToDelete === 0) {
      console.log('\n✅ No data to delete. Database is already clean.');
      return;
    }

    // Check for confirmation flag
    const needsConfirmation = !process.argv.includes('--confirm');
    
    if (needsConfirmation) {
      console.log('\n⚠️  WARNING: This will delete ALL clients, meetings, and related data!');
      console.log('   This will also delete all files from S3/MinIO storage!');
      console.log('   To proceed without confirmation, use: npx tsx scripts/clean-database.ts --confirm');
      console.log('\n   Exiting without changes.');
      return;
    }

    console.log('\n🗑️  Starting deletion process...\n');

    // Step 1: Delete files from S3/MinIO (before deleting DB records)
    console.log('📁 Step 1: Deleting files from S3/MinIO storage...');
    const s3Result = await deleteFilesFromS3();
    console.log(`   ✅ Deleted ${s3Result.deleted} file(s) from S3`);
    if (s3Result.errors > 0) {
      console.log(`   ⚠️  ${s3Result.errors} file(s) failed to delete (may not exist)`);
    }

    // Step 2: Delete all meetings (cascade will handle related tables)
    console.log('\n🗑️  Step 2: Deleting all Meeting records (cascade will delete related records)...');
    const meetingResult = await prisma.$transaction(async (tx) => {
      const deletedCount = await tx.meeting.deleteMany({});
      return deletedCount.count;
    });
    console.log(`   ✅ Deleted ${meetingResult} meeting record(s)`);

    // Step 3: Delete all clients
    console.log('\n🗑️  Step 3: Deleting all Client records...');
    const clientResult = await prisma.$transaction(async (tx) => {
      const deletedCount = await tx.client.deleteMany({});
      return deletedCount.count;
    });
    console.log(`   ✅ Deleted ${clientResult} client record(s)`);

    // Get statistics after deletion
    console.log('\n📊 Statistics AFTER cleanup:');
    const statsAfter = await getStatistics();
    console.log('\n   Remaining data (should be 0):');
    console.log(`      Clients: ${statsAfter.clientCount}`);
    console.log(`      Meetings: ${statsAfter.meetingCount}`);
    console.log(`      MeetingParticipants: ${statsAfter.meetingParticipantCount}`);
    console.log(`      MeetingViewers: ${statsAfter.meetingViewerCount}`);
    console.log(`      UploadBlobs: ${statsAfter.uploadBlobCount}`);
    console.log(`      Transcripts: ${statsAfter.transcriptCount}`);
    console.log(`      Artifacts: ${statsAfter.artifactsCount}`);
    console.log(`      Validations: ${statsAfter.validationCount}`);
    console.log(`      ProcessingErrors: ${statsAfter.processingErrorCount}`);
    console.log(`      LLMInteractions: ${statsAfter.llmInteractionCount}`);
    console.log('\n   Kept data:');
    console.log(`      Users: ${statsAfter.userCount}`);
    console.log(`      MeetingTypes: ${statsAfter.meetingTypeCount}`);
    console.log(`      PromptScenarios: ${statsAfter.scenarioCount}`);
    console.log(`      DirectoryParticipants: ${statsAfter.participantCount}`);

    // Verify all related records are deleted
    const allClean = 
      statsAfter.clientCount === 0 &&
      statsAfter.meetingCount === 0 &&
      statsAfter.meetingParticipantCount === 0 &&
      statsAfter.meetingViewerCount === 0 &&
      statsAfter.uploadBlobCount === 0 &&
      statsAfter.transcriptCount === 0 &&
      statsAfter.artifactsCount === 0 &&
      statsAfter.validationCount === 0 &&
      statsAfter.processingErrorCount === 0 &&
      statsAfter.llmInteractionCount === 0;

    if (allClean) {
      console.log('\n✅ All test data has been successfully cleaned!');
      console.log('✅ Database is ready for work without test records.');
    } else {
      console.log('\n⚠️  Warning: Some records may still exist. Please check manually.');
    }

  } catch (error) {
    console.error('\n❌ Error during cleanup:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

cleanDatabase()
  .then(() => {
    console.log('\n✨ Cleanup completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Cleanup failed:', error);
    process.exit(1);
  });




