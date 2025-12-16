/**
 * Script to cleanup meetings and related data
 * Keeps: Users, MeetingTypes, PromptScenarios, DirectoryParticipants
 * Deletes: Meetings, Clients, and all meeting-related records
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanup() {
  console.log('🧹 Starting cleanup...');

  try {
    // Delete in order to respect foreign key constraints
    // First delete all meetings (cascade will handle related records)
    
    const meetingsCount = await prisma.meeting.count();
    console.log(`📊 Found ${meetingsCount} meetings to delete`);

    // Delete all meetings (cascade deletes: MeetingParticipant, MeetingViewer, 
    // UploadBlob, Transcript, Artifacts, Validation, ProcessingError, LLMInteraction)
    await prisma.meeting.deleteMany({});
    console.log('✅ Deleted all meetings and related records');

    // Delete all clients
    const clientsCount = await prisma.client.count();
    console.log(`📊 Found ${clientsCount} clients to delete`);
    await prisma.client.deleteMany({});
    console.log('✅ Deleted all clients');

    // Verify what's left
    const usersCount = await prisma.user.count();
    const meetingTypesCount = await prisma.meetingType.count();
    const scenariosCount = await prisma.promptScenario.count();
    const participantsCount = await prisma.directoryParticipant.count();

    console.log('\n📋 Remaining data:');
    console.log(`  - Users: ${usersCount}`);
    console.log(`  - Meeting Types: ${meetingTypesCount}`);
    console.log(`  - Scenarios: ${scenariosCount}`);
    console.log(`  - Directory Participants: ${participantsCount}`);

    console.log('\n🎉 Cleanup completed successfully!');
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

cleanup()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  });






