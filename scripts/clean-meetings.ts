/**
 * Script to clean all Meeting records and related tables
 * Usage: npx tsx scripts/clean-meetings.ts [--confirm]
 * 
 * WARNING: This will delete ALL meetings and all related data:
 * - MeetingParticipant
 * - MeetingViewer
 * - UploadBlob
 * - Transcript
 * - Artifacts
 * - Validation
 * - ProcessingError
 * - LLMInteraction
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

    return {
      meetingCount,
      meetingParticipantCount,
      meetingViewerCount,
      uploadBlobCount,
      transcriptCount,
      artifactsCount,
      validationCount,
      processingErrorCount,
      llmInteractionCount,
    };
  } catch (error) {
    console.error('Error getting statistics:', error);
    throw error;
  }
}

async function cleanMeetings() {
  console.log('\n🧹 Starting Meeting cleanup...\n');

  try {
    // Get statistics before deletion
    console.log('📊 Statistics BEFORE deletion:');
    const statsBefore = await getStatistics();
    console.log(`   Meeting: ${statsBefore.meetingCount}`);
    console.log(`   MeetingParticipant: ${statsBefore.meetingParticipantCount}`);
    console.log(`   MeetingViewer: ${statsBefore.meetingViewerCount}`);
    console.log(`   UploadBlob: ${statsBefore.uploadBlobCount}`);
    console.log(`   Transcript: ${statsBefore.transcriptCount}`);
    console.log(`   Artifacts: ${statsBefore.artifactsCount}`);
    console.log(`   Validation: ${statsBefore.validationCount}`);
    console.log(`   ProcessingError: ${statsBefore.processingErrorCount}`);
    console.log(`   LLMInteraction: ${statsBefore.llmInteractionCount}`);

    if (statsBefore.meetingCount === 0) {
      console.log('\n✅ No meetings to delete. Database is already clean.');
      return;
    }

    // Check for confirmation flag
    const needsConfirmation = !process.argv.includes('--confirm');
    
    if (needsConfirmation) {
      console.log('\n⚠️  WARNING: This will delete ALL meetings and related data!');
      console.log('   To proceed without confirmation, use: npx tsx scripts/clean-meetings.ts --confirm');
      console.log('\n   Exiting without changes.');
      return;
    }

    console.log('\n🗑️  Deleting all Meeting records (cascade will delete related records)...');

    // Delete all meetings - cascade will handle related tables
    const result = await prisma.$transaction(async (tx) => {
      const deletedCount = await tx.meeting.deleteMany({});
      return deletedCount.count;
    });

    console.log(`\n✅ Deleted ${result} meeting record(s)`);

    // Get statistics after deletion
    console.log('\n📊 Statistics AFTER deletion:');
    const statsAfter = await getStatistics();
    console.log(`   Meeting: ${statsAfter.meetingCount}`);
    console.log(`   MeetingParticipant: ${statsAfter.meetingParticipantCount}`);
    console.log(`   MeetingViewer: ${statsAfter.meetingViewerCount}`);
    console.log(`   UploadBlob: ${statsAfter.uploadBlobCount}`);
    console.log(`   Transcript: ${statsAfter.transcriptCount}`);
    console.log(`   Artifacts: ${statsAfter.artifactsCount}`);
    console.log(`   Validation: ${statsAfter.validationCount}`);
    console.log(`   ProcessingError: ${statsAfter.processingErrorCount}`);
    console.log(`   LLMInteraction: ${statsAfter.llmInteractionCount}`);

    // Verify all related records are deleted
    const allClean = Object.values(statsAfter).every(count => count === 0);
    if (allClean) {
      console.log('\n✅ All Meeting-related data has been successfully cleaned!');
    } else {
      console.log('\n⚠️  Warning: Some related records may still exist. Please check manually.');
    }

  } catch (error) {
    console.error('\n❌ Error during cleanup:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

cleanMeetings()
  .then(() => {
    console.log('\n✨ Cleanup completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Cleanup failed:', error);
    process.exit(1);
  });

