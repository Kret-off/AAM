/**
 * Script to analyze a failed meeting and try to reproduce the error
 * Usage: npx tsx scripts/analyze-failed-meeting.ts <meetingId>
 */

import { PrismaClient } from '@prisma/client';
import { downloadFileFromS3 } from '@/lib/orchestrator/s3-utils';
import { transcribe } from '@/lib/deepgram-adapter';
import { processTranscription } from '@/lib/orchestrator/processors/transcription';
import { generateShortId } from '@/lib/db/id-generator';

const prisma = new PrismaClient();

async function analyzeFailedMeeting(meetingId: string) {
  console.log(`\n🔍 Analyzing failed meeting: ${meetingId}\n`);

  try {
    // Get meeting details
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

    console.log('📊 Meeting Status:');
    console.log(`   Status: ${meeting.status}`);
    console.log(`   Created At: ${meeting.createdAt.toISOString()}`);
    console.log(`   Has Transcript: ${meeting.transcript ? '✅ Yes' : '❌ No'}`);
    console.log(`   Has Artifacts: ${meeting.artifacts ? '✅ Yes' : '❌ No'}`);
    console.log();

    if (!meeting.uploadBlob) {
      console.log('❌ UploadBlob not found');
      return;
    }

    // Step 1: Test direct transcription
    console.log('🧪 Step 1: Testing direct Deepgram transcription...');
    try {
      const fileBuffer = await downloadFileFromS3(meeting.uploadBlob.storagePath);
      console.log(`   ✅ File downloaded: ${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB`);

      const transcriptionResult = await transcribe({
        fileBuffer,
        language: undefined,
      });

      if ('error' in transcriptionResult) {
        console.log('   ❌ Direct transcription failed:');
        console.log(`      Code: ${transcriptionResult.error.code}`);
        console.log(`      Message: ${transcriptionResult.error.message}`);
        console.log(`      Details:`, JSON.stringify(transcriptionResult.error.details, null, 2));
        return;
      }

      console.log('   ✅ Direct transcription successful');
      console.log(`      Transcript length: ${transcriptionResult.data.transcriptText.length} chars`);
      console.log(`      Segments: ${transcriptionResult.data.segments.length}`);
      console.log(`      Keyterms: ${transcriptionResult.data.keyterms.length}`);
      console.log(`      Language: ${transcriptionResult.data.language}`);

      // Check data structure
      console.log('\n   📋 Data Structure Check:');
      console.log(`      Segments type: ${Array.isArray(transcriptionResult.data.segments) ? '✅ Array' : '❌ Not array'}`);
      console.log(`      Keyterms type: ${Array.isArray(transcriptionResult.data.keyterms) ? '✅ Array' : '❌ Not array'}`);
      
      if (transcriptionResult.data.segments.length > 0) {
        const firstSegment = transcriptionResult.data.segments[0];
        console.log(`      First segment structure:`, JSON.stringify(firstSegment, null, 2));
      }

      if (transcriptionResult.data.keyterms.length > 0) {
        const firstKeyterm = transcriptionResult.data.keyterms[0];
        console.log(`      First keyterm structure:`, JSON.stringify(firstKeyterm, null, 2));
      }

      // Step 2: Test saving to database
      console.log('\n🧪 Step 2: Testing database save...');
      try {
        // Check if transcript already exists
        const existingTranscript = await prisma.transcript.findUnique({
          where: { meetingId },
        });

        if (existingTranscript) {
          console.log('   ⚠️  Transcript already exists, skipping save test');
        } else {
          // Try to save
          const transcriptId = await generateShortId('transcript');
          const savedTranscript = await prisma.transcript.create({
            data: {
              id: transcriptId,
              meetingId,
              transcriptText: transcriptionResult.data.transcriptText,
              segments: transcriptionResult.data.segments as any,
              keyterms: transcriptionResult.data.keyterms as any,
              language: transcriptionResult.data.language,
            },
          });
          console.log('   ✅ Transcript saved successfully');
          console.log(`      Saved ID: ${savedTranscript.id}`);

          // Clean up - delete the test transcript
          await prisma.transcript.delete({
            where: { id: savedTranscript.id },
          });
          console.log('   🧹 Test transcript cleaned up');
        }
      } catch (dbError: any) {
        console.log('   ❌ Database save failed:');
        console.log(`      Message: ${dbError.message}`);
        console.log(`      Code: ${dbError.code || 'Unknown'}`);
        console.log(`      Details:`, dbError);
        return;
      }

      // Step 3: Test full processTranscription function
      console.log('\n🧪 Step 3: Testing full processTranscription function...');
      console.log('   (This will use the actual meeting processing logic)');
      
      // Reset meeting status if needed
      if (meeting.status === 'Failed_Transcription') {
        console.log('   ⚠️  Meeting is in Failed_Transcription status');
        console.log('   ⚠️  Note: processTranscription will skip if transcript exists');
        console.log('   ⚠️  To test fully, you may need to delete existing transcript first');
      }

      const processResult = await processTranscription(meetingId);
      
      if (processResult.success) {
        console.log('   ✅ processTranscription completed successfully');
      } else {
        console.log('   ❌ processTranscription failed:');
        console.log(`      Code: ${processResult.error?.code}`);
        console.log(`      Message: ${processResult.error?.message}`);
        console.log(`      Details:`, JSON.stringify(processResult.error?.details, null, 2));
      }

    } catch (error: any) {
      console.error('   ❌ Error during testing:', error.message);
      console.error('   Stack:', error.stack);
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
  console.error('Usage: npx tsx scripts/analyze-failed-meeting.ts <meetingId>');
  process.exit(1);
}

analyzeFailedMeeting(meetingId);





