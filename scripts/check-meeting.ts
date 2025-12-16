/**
 * Script to check meeting file processing status
 * Usage: npx tsx scripts/check-meeting.ts <meetingId>
 */

import { PrismaClient } from '@prisma/client';
import { validateMeetingId } from '../lib/meeting/validation';

const prisma = new PrismaClient();

async function checkMeeting(meetingId: string) {
  console.log(`\n🔍 Checking meeting: ${meetingId}\n`);

  // Validate meeting ID format
  const idValidation = validateMeetingId(meetingId);
  if (!idValidation.valid) {
    console.error(`❌ Invalid meeting ID format: ${idValidation.error?.message || 'Unknown error'}`);
    console.error(`   Expected format: met{N} (e.g., met1, met42)`);
    process.exit(1);
  }

  try {
    // Get meeting with all relations
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        uploadBlob: true,
        transcript: {
          select: {
            id: true,
            language: true,
            createdAt: true,
            transcriptText: true,
          },
        },
        artifacts: {
          select: {
            id: true,
            createdAt: true,
          },
        },
        validation: {
          select: {
            decision: true,
            validatedAt: true,
          },
        },
      },
    });

    if (!meeting) {
      console.log('❌ Meeting not found');
      return;
    }

    console.log('📊 Meeting Status:');
    console.log(`   ID: ${meeting.id}`);
    console.log(`   Status: ${meeting.status}`);
    console.log(`   Created: ${meeting.createdAt.toISOString()}`);
    console.log(`   Title: ${meeting.title || '(no title)'}`);

    console.log('\n📁 Upload Blob:');
    if (meeting.uploadBlob) {
      console.log(`   ✅ EXISTS`);
      console.log(`   Filename: ${meeting.uploadBlob.originalFilename}`);
      console.log(`   MIME Type: ${meeting.uploadBlob.mimeType}`);
      console.log(`   Size: ${(Number(meeting.uploadBlob.sizeBytes) / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   Storage Path: ${meeting.uploadBlob.storagePath}`);
      console.log(`   Created: ${meeting.uploadBlob.createdAt.toISOString()}`);
      console.log(`   Expires At: ${meeting.uploadBlob.expiresAt?.toISOString() || 'Not set'}`);
      console.log(`   Deleted At: ${meeting.uploadBlob.deletedAt?.toISOString() || 'Not deleted'}`);
    } else {
      console.log('   ❌ NOT FOUND');
    }

    console.log('\n📝 Transcript:');
    if (meeting.transcript) {
      console.log(`   ✅ EXISTS`);
      console.log(`   Language: ${meeting.transcript.language}`);
      console.log(`   Created: ${meeting.transcript.createdAt.toISOString()}`);
      const textPreview = typeof meeting.transcript.transcriptText === 'string' 
        ? meeting.transcript.transcriptText.substring(0, 100) + '...'
        : '(not a string)';
      console.log(`   Preview: ${textPreview}`);
    } else {
      console.log('   ❌ NOT FOUND');
    }

    console.log('\n🤖 Artifacts:');
    if (meeting.artifacts) {
      console.log(`   ✅ EXISTS`);
      console.log(`   Created: ${meeting.artifacts.createdAt.toISOString()}`);
    } else {
      console.log('   ❌ NOT FOUND');
    }

    console.log('\n✅ Validation:');
    if (meeting.validation) {
      console.log(`   ✅ EXISTS`);
      console.log(`   Decision: ${meeting.validation.decision}`);
      console.log(`   Validated At: ${meeting.validation.validatedAt?.toISOString() || 'N/A'}`);
    } else {
      console.log('   ❌ NOT FOUND');
    }

    // Check job status in Redis/BullMQ (if accessible)
    console.log('\n🔄 Processing Pipeline Status:');
    const expectedFlow = [
      { status: 'Uploaded', required: true },
      { status: 'Transcribing', required: meeting.uploadBlob && !meeting.transcript },
      { status: 'LLM_Processing', required: meeting.transcript && !meeting.artifacts },
      { status: 'Ready', required: meeting.artifacts && !meeting.validation },
    ];

    for (const step of expectedFlow) {
      if (step.required) {
        console.log(`   ${meeting.status === step.status ? '✅' : '⏳'} ${step.status}`);
      }
    }

    // Analyze what might be wrong
    console.log('\n🔍 Analysis:');
    if (!meeting.uploadBlob) {
      console.log('   ⚠️  UploadBlob missing - file was never uploaded or was deleted');
    } else if (meeting.uploadBlob.deletedAt) {
      console.log(`   ⚠️  UploadBlob was deleted at ${meeting.uploadBlob.deletedAt.toISOString()}`);
    } else if (!meeting.transcript && meeting.status === 'Uploaded') {
      console.log('   ⚠️  File uploaded but transcription not started - job may not have been enqueued');
    } else if (!meeting.transcript && meeting.status !== 'Failed_Transcription') {
      console.log('   ⚠️  Transcription in progress or failed silently');
    } else if (meeting.transcript && !meeting.artifacts && meeting.status !== 'LLM_Processing') {
      console.log('   ⚠️  Transcript exists but LLM processing not started');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

const meetingId = process.argv[2];
if (!meetingId) {
  console.error('Usage: npx tsx scripts/check-meeting.ts <meetingId>');
  process.exit(1);
}

checkMeeting(meetingId);

