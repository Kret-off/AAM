/**
 * Script to test Deepgram transcription with a real file
 * Usage: npx tsx scripts/test-deepgram-transcription.ts <meetingId>
 */

import { PrismaClient } from '@prisma/client';
import { downloadFileFromS3 } from '@/lib/orchestrator/s3-utils';
import { transcribe } from '@/lib/deepgram-adapter';

const prisma = new PrismaClient();

async function testTranscription(meetingId: string) {
  console.log(`\n🧪 Testing Deepgram transcription for meeting: ${meetingId}\n`);

  try {
    // Get meeting with upload blob
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      select: {
        id: true,
        status: true,
        uploadBlob: {
          select: {
            id: true,
            storagePath: true,
            mimeType: true,
            sizeBytes: true,
            originalFilename: true,
          },
        },
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

    console.log('📁 File Information:');
    console.log(`   Storage Path: ${meeting.uploadBlob.storagePath}`);
    console.log(`   Size: ${(Number(meeting.uploadBlob.sizeBytes) / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   MIME Type: ${meeting.uploadBlob.mimeType}`);
    console.log(`   Original Filename: ${meeting.uploadBlob.originalFilename}`);
    console.log();

    // Download file from S3
    console.log('⬇️  Downloading file from S3...');
    let fileBuffer: Buffer;
    try {
      fileBuffer = await downloadFileFromS3(meeting.uploadBlob.storagePath);
      console.log(`✅ File downloaded successfully, size: ${fileBuffer.length} bytes (${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB)`);
    } catch (error: any) {
      console.error('❌ Failed to download file from S3:', error.message);
      console.error('   Error details:', error);
      return;
    }

    // Test transcription
    console.log('\n🎤 Testing Deepgram transcription...');
    console.log('   This may take a while for large files...\n');

    const startTime = Date.now();
    const transcriptionResult = await transcribe({
      fileBuffer,
      language: undefined, // Auto-detect
    });
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    if ('error' in transcriptionResult) {
      console.error('❌ Transcription failed:');
      console.error(`   Code: ${transcriptionResult.error.code}`);
      console.error(`   Message: ${transcriptionResult.error.message}`);
      console.error(`   Details:`, JSON.stringify(transcriptionResult.error.details, null, 2));
      return;
    }

    console.log(`✅ Transcription successful! (took ${duration}s)`);
    console.log('\n📝 Results:');
    console.log(`   Language: ${transcriptionResult.data.language}`);
    console.log(`   Duration: ${transcriptionResult.data.duration}s`);
    console.log(`   Transcript length: ${transcriptionResult.data.transcriptText.length} characters`);
    console.log(`   Segments: ${transcriptionResult.data.segments.length}`);
    console.log(`   Keyterms: ${transcriptionResult.data.keyterms.length}`);
    
    if (transcriptionResult.data.transcriptText.length > 0) {
      console.log(`\n📄 First 500 characters of transcript:`);
      console.log(transcriptionResult.data.transcriptText.substring(0, 500) + '...');
    }

  } catch (error: any) {
    console.error('❌ Unexpected error:', error.message);
    console.error('   Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

const meetingId = process.argv[2];
if (!meetingId) {
  console.error('Usage: npx tsx scripts/test-deepgram-transcription.ts <meetingId>');
  process.exit(1);
}

testTranscription(meetingId);








