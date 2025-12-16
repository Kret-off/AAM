/**
 * Script to update output_schema for all scenarios
 * Renames missing_info_questions to missing_data_items in output_schema
 * Usage: npx tsx scripts/update-scenario-schemas.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateScenarioSchemas() {
  console.log('🔧 Updating output_schema for all scenarios...\n');

  try {
    const scenarios = await prisma.promptScenario.findMany({
      select: {
        id: true,
        name: true,
        outputSchema: true,
        version: true,
      },
    });

    console.log(`Found ${scenarios.length} scenarios\n`);

    let updatedCount = 0;

    for (const scenario of scenarios) {
      if (!scenario.outputSchema || typeof scenario.outputSchema !== 'object') {
        console.log(`⏭️  Skipping ${scenario.name} (no outputSchema or invalid format)`);
        continue;
      }

      const schema = scenario.outputSchema as Record<string, unknown>;

      // Check if schema has the old field structure
      const quality = schema.properties as Record<string, unknown>;
      if (!quality || typeof quality !== 'object') {
        console.log(`⏭️  Skipping ${scenario.name} (no quality in properties)`);
        continue;
      }

      const qualityProps = quality.quality as Record<string, unknown>;
      if (!qualityProps || typeof qualityProps !== 'object') {
        console.log(`⏭️  Skipping ${scenario.name} (no quality.properties)`);
        continue;
      }

      const qualityProperties = qualityProps.properties as Record<string, unknown>;
      if (!qualityProperties || typeof qualityProperties !== 'object') {
        console.log(`⏭️  Skipping ${scenario.name} (no quality.properties.properties)`);
        continue;
      }

      // Check if old field exists
      if (!('missing_info_questions' in qualityProperties)) {
        console.log(`⏭️  Skipping ${scenario.name} (no missing_info_questions field)`);
        continue;
      }

      // Update schema
      const newSchema = JSON.parse(JSON.stringify(schema)) as Record<string, unknown>;
      const newQuality = newSchema.properties as Record<string, unknown>;
      const newQualityProps = newQuality.quality as Record<string, unknown>;
      const newQualityProperties = newQualityProps.properties as Record<string, unknown>;

      // Rename field
      newQualityProperties.missing_data_items = newQualityProperties.missing_info_questions;
      delete newQualityProperties.missing_info_questions;

      // Update required array
      const required = newQualityProps.required as string[] | undefined;
      if (Array.isArray(required)) {
        const newRequired = required.map((item) =>
          item === 'missing_info_questions' ? 'missing_data_items' : item
        );
        newQualityProps.required = newRequired;
      }

      // Update scenario
      await prisma.promptScenario.update({
        where: { id: scenario.id },
        data: {
          outputSchema: newSchema,
          version: scenario.version + 1,
        },
      });

      console.log(`✅ Updated ${scenario.name} (version ${scenario.version + 1})`);
      updatedCount++;
    }

    console.log(`\n✅ Updated ${updatedCount} scenario(s)`);
  } catch (error) {
    console.error('❌ Error updating scenarios:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

updateScenarioSchemas();







