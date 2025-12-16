/**
 * Script to update system prompt for Default First Meeting Scenario
 * Usage: npx tsx scripts/update-first-meeting-prompt.ts
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

async function updateFirstMeetingPrompt() {
  console.log('🔧 Updating system prompt and output schema for Default First Meeting Scenario...\n');

  try {
    // Read prompt from file
    const promptPath = join(process.cwd(), 'first-meeting-scenario-prompt.md');
    const systemPrompt = readFileSync(promptPath, 'utf-8');

    // Read output schema from file
    const schemaPath = join(process.cwd(), 'first-meeting-scenario-output-schema.json');
    const outputSchema = JSON.parse(readFileSync(schemaPath, 'utf-8'));

    console.log(`✅ Read prompt from file (${systemPrompt.length} characters)`);
    console.log(`✅ Read output schema from file\n`);

    // Find First meeting type
    const firstMeetingType = await prisma.meetingType.findFirst({
      where: { name: 'First' },
    });

    if (!firstMeetingType) {
      console.error('❌ First meeting type not found');
      return;
    }

    console.log(`✅ Found meeting type: ${firstMeetingType.name} (${firstMeetingType.id})\n`);

    // Find Default First Meeting Scenario
    const scenario = await prisma.promptScenario.findFirst({
      where: {
        meetingTypeId: firstMeetingType.id,
        name: 'Default First Meeting Scenario',
      },
    });

    if (!scenario) {
      console.error('❌ Default First Meeting Scenario not found');
      return;
    }

    console.log(`✅ Found scenario: ${scenario.name} (${scenario.id})`);
    console.log(`   Current version: ${scenario.version}\n`);

    // Update scenario
    const updatedScenario = await prisma.promptScenario.update({
      where: { id: scenario.id },
      data: {
        systemPrompt: systemPrompt,
        outputSchema: outputSchema,
        version: scenario.version + 1, // Increment version
      },
      select: {
        id: true,
        name: true,
        version: true,
        updatedAt: true,
      },
    });

    console.log('✅ Scenario updated successfully!\n');
    console.log(`   ID: ${updatedScenario.id}`);
    console.log(`   Name: ${updatedScenario.name}`);
    console.log(`   Version: ${updatedScenario.version}`);
    console.log(`   Updated at: ${updatedScenario.updatedAt}\n`);
  } catch (error) {
    console.error('❌ Error updating scenario:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

updateFirstMeetingPrompt();

