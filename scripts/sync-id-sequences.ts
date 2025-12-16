/**
 * Sync ID Sequences Script
 * 
 * Synchronizes id_sequence table with actual max IDs in database.
 * Run this if you see "ID already exists" errors.
 * 
 * Usage: npx tsx scripts/sync-id-sequences.ts
 */

import { prisma } from '../lib/prisma';

interface SequenceInfo {
  tableName: string;
  prefix: string;
  maxId: number;
  currentSequence: number;
  needsUpdate: boolean;
}

async function syncSequences() {
  console.log('🔄 Syncing ID sequences...\n');

  const tables: { model: string; tableName: string; prefix: string }[] = [
    { model: 'meeting', tableName: 'meeting', prefix: 'met' },
    { model: 'uploadBlob', tableName: 'upload_blob', prefix: 'upl' },
    { model: 'client', tableName: 'client', prefix: 'cli' },
    { model: 'directoryParticipant', tableName: 'directory_participant', prefix: 'par' },
    { model: 'meetingType', tableName: 'meeting_type', prefix: 'mty' },
    { model: 'promptScenario', tableName: 'prompt_scenario', prefix: 'scn' },
    { model: 'user', tableName: 'user', prefix: 'usr' },
    { model: 'processingError', tableName: 'processing_error', prefix: 'err' },
    { model: 'transcript', tableName: 'transcript', prefix: 'trs' },
    { model: 'artifacts', tableName: 'artifacts', prefix: 'art' },
    { model: 'validation', tableName: 'validation', prefix: 'val' },
    { model: 'meetingParticipant', tableName: 'meeting_participant', prefix: 'mpt' },
    { model: 'meetingViewer', tableName: 'meeting_viewer', prefix: 'mvw' },
    { model: 'llmInteraction', tableName: 'llm_interaction', prefix: 'llm' },
  ];

  const results: SequenceInfo[] = [];

  for (const table of tables) {
    try {
      // Get all IDs from table using Prisma model name
      const records = await (prisma as any)[table.model].findMany({
        select: { id: true },
      });

      if (records.length === 0) {
        console.log(`⚪ ${table.tableName}: No records found, skipping...`);
        continue;
      }

      // Extract max numeric ID
      const maxNumber = Math.max(
        ...records.map((r: any) => {
          const num = parseInt(r.id.replace(table.prefix, ''));
          return isNaN(num) ? 0 : num;
        })
      );

      // Get current sequence value
      const sequence = await prisma.$queryRawUnsafe<Array<{ table_name: string; current_value: bigint }>>(
        'SELECT * FROM id_sequence WHERE table_name = $1',
        table.tableName
      );

      const currentSeq = sequence.length > 0 ? Number(sequence[0].current_value) : 0;
      const needsUpdate = maxNumber > currentSeq;

      results.push({
        tableName: table.tableName,
        prefix: table.prefix,
        maxId: maxNumber,
        currentSequence: currentSeq,
        needsUpdate,
      });

      if (needsUpdate) {
        // Update sequence
        await prisma.$executeRawUnsafe(
          'INSERT INTO id_sequence (table_name, current_value) VALUES ($1, $2) ON CONFLICT (table_name) DO UPDATE SET current_value = $2',
          table.tableName,
          maxNumber
        );
        console.log(`✅ ${table.tableName}: Updated ${currentSeq} → ${maxNumber} (next: ${table.prefix}${maxNumber + 1})`);
      } else {
        console.log(`✓  ${table.tableName}: OK (max: ${maxNumber}, seq: ${currentSeq}, next: ${table.prefix}${currentSeq + 1})`);
      }
    } catch (error) {
      console.error(`❌ ${table.tableName}: Error -`, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  console.log('\n📊 Summary:');
  console.log(`  Total tables checked: ${tables.length}`);
  console.log(`  Updated: ${results.filter(r => r.needsUpdate).length}`);
  console.log(`  OK: ${results.filter(r => !r.needsUpdate).length}`);

  await prisma.$disconnect();
}

// Run if called directly
if (require.main === module) {
  syncSequences()
    .then(() => {
      console.log('\n✅ Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Error:', error);
      process.exit(1);
    });
}

export { syncSequences };

