/**
 * Test script for short ID generation
 * Tests creation of entities with new short ID format
 */

import { PrismaClient } from '@prisma/client';
import { generateShortId } from '../lib/db/id-generator';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function testShortIdGeneration() {
  console.log('🧪 Testing short ID generation...\n');

  try {
    // Test 1: Generate User ID
    console.log('1️⃣ Testing User ID generation...');
    const userId = await generateShortId('user');
    console.log(`   ✅ Generated User ID: ${userId}`);
    if (!userId.startsWith('usr')) {
      throw new Error(`Invalid User ID prefix: ${userId}`);
    }

    // Test 2: Generate Client ID
    console.log('\n2️⃣ Testing Client ID generation...');
    const clientId = await generateShortId('client');
    console.log(`   ✅ Generated Client ID: ${clientId}`);
    if (!clientId.startsWith('cli')) {
      throw new Error(`Invalid Client ID prefix: ${clientId}`);
    }

    // Test 3: Generate Meeting Type ID
    console.log('\n3️⃣ Testing MeetingType ID generation...');
    const meetingTypeId = await generateShortId('meeting_type');
    console.log(`   ✅ Generated MeetingType ID: ${meetingTypeId}`);
    if (!meetingTypeId.startsWith('mty')) {
      throw new Error(`Invalid MeetingType ID prefix: ${meetingTypeId}`);
    }

    // Test 4: Generate Meeting ID
    console.log('\n4️⃣ Testing Meeting ID generation...');
    const meetingId = await generateShortId('meeting');
    console.log(`   ✅ Generated Meeting ID: ${meetingId}`);
    if (!meetingId.startsWith('met')) {
      throw new Error(`Invalid Meeting ID prefix: ${meetingId}`);
    }

    // Test 5: Test sequential generation (should increment)
    console.log('\n5️⃣ Testing sequential ID generation...');
    const id1 = await generateShortId('client');
    const id2 = await generateShortId('client');
    console.log(`   ✅ First ID: ${id1}`);
    console.log(`   ✅ Second ID: ${id2}`);
    
    const num1 = parseInt(id1.replace('cli', ''));
    const num2 = parseInt(id2.replace('cli', ''));
    if (num2 !== num1 + 1) {
      throw new Error(`IDs are not sequential: ${id1} -> ${id2}`);
    }

    // Test 6: Create actual User entity
    console.log('\n6️⃣ Testing User entity creation...');
    const testUserId = await generateShortId('user');
    const passwordHash = await bcrypt.hash('Test123!', 10);
    const testUser = await prisma.user.create({
      data: {
        id: testUserId,
        email: `test-${Date.now()}@example.com`,
        passwordHash,
        name: 'Test User',
        role: 'USER',
        isActive: true,
      },
    });
    console.log(`   ✅ Created User with ID: ${testUser.id}`);
    
    // Cleanup
    await prisma.user.delete({ where: { id: testUser.id } });
    console.log(`   🧹 Cleaned up test user`);

    // Test 7: Create actual Client entity (using existing user)
    console.log('\n7️⃣ Testing Client entity creation...');
    const existingUser = await prisma.user.findFirst({
      select: { id: true },
    });
    
    if (existingUser) {
      const testClientId = await generateShortId('client');
      const testClient = await prisma.client.create({
        data: {
          id: testClientId,
          name: `Test Client ${Date.now()}`,
          createdByUserId: existingUser.id,
        },
      });
      console.log(`   ✅ Created Client with ID: ${testClient.id}`);
      
      // Cleanup
      await prisma.client.delete({ where: { id: testClient.id } });
      console.log(`   🧹 Cleaned up test client`);
    } else {
      console.log(`   ⚠️  Skipping client creation (no existing user found)`);
    }

    console.log('\n✅ All tests passed!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

testShortIdGeneration()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });




