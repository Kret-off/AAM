/**
 * Migration Script: Convert UUID IDs to Short IDs
 * 
 * This script converts all existing UUID IDs to short IDs with table prefixes.
 * It must be run BEFORE applying the schema changes that remove @default(uuid()).
 * 
 * Usage:
 *   npx tsx scripts/migrate-uuid-to-short-id.ts
 */

import { PrismaClient } from '@prisma/client';
import { generateShortId, initializeCounter, getCurrentCounter } from '../lib/db/id-generator';

const prisma = new PrismaClient();

interface TableMigration {
  tableName: string;
  modelName: string;
  foreignKeyColumns: Array<{
    table: string;
    column: string;
    model: string;
  }>;
}

const TABLES_TO_MIGRATE: TableMigration[] = [
  {
    tableName: 'user',
    modelName: 'user',
    foreignKeyColumns: [
      { table: 'client', column: 'created_by_user_id', model: 'client' },
      { table: 'meeting', column: 'owner_user_id', model: 'meeting' },
      { table: 'meeting_viewer', column: 'user_id', model: 'meetingViewer' },
      { table: 'meeting_viewer', column: 'added_by_user_id', model: 'meetingViewer' },
      { table: 'directory_participant', column: 'created_by_user_id', model: 'directoryParticipant' },
      { table: 'prompt_scenario', column: 'updated_by_user_id', model: 'promptScenario' },
      { table: 'validation', column: 'validated_by_user_id', model: 'validation' },
      { table: 'user_meeting_type', column: 'user_id', model: 'userMeetingType' },
    ],
  },
  {
    tableName: 'client',
    modelName: 'client',
    foreignKeyColumns: [
      { table: 'meeting', column: 'client_id', model: 'meeting' },
    ],
  },
  {
    tableName: 'meeting_type',
    modelName: 'meetingType',
    foreignKeyColumns: [
      { table: 'meeting', column: 'meeting_type_id', model: 'meeting' },
      { table: 'prompt_scenario', column: 'meeting_type_id', model: 'promptScenario' },
      { table: 'user_meeting_type', column: 'meeting_type_id', model: 'userMeetingType' },
    ],
  },
  {
    tableName: 'prompt_scenario',
    modelName: 'promptScenario',
    foreignKeyColumns: [
      { table: 'meeting', column: 'scenario_id', model: 'meeting' },
    ],
  },
  {
    tableName: 'directory_participant',
    modelName: 'directoryParticipant',
    foreignKeyColumns: [
      { table: 'meeting_participant', column: 'participant_id', model: 'meetingParticipant' },
    ],
  },
  {
    tableName: 'meeting',
    modelName: 'meeting',
    foreignKeyColumns: [
      { table: 'meeting_participant', column: 'meeting_id', model: 'meetingParticipant' },
      { table: 'meeting_viewer', column: 'meeting_id', model: 'meetingViewer' },
      { table: 'upload_blob', column: 'meeting_id', model: 'uploadBlob' },
      { table: 'transcript', column: 'meeting_id', model: 'transcript' },
      { table: 'artifacts', column: 'meeting_id', model: 'artifacts' },
      { table: 'validation', column: 'meeting_id', model: 'validation' },
      { table: 'processing_error', column: 'meeting_id', model: 'processingError' },
      { table: 'llm_interaction', column: 'meeting_id', model: 'lLMInteraction' },
    ],
  },
  {
    tableName: 'upload_blob',
    modelName: 'uploadBlob',
    foreignKeyColumns: [],
  },
  {
    tableName: 'transcript',
    modelName: 'transcript',
    foreignKeyColumns: [],
  },
  {
    tableName: 'artifacts',
    modelName: 'artifacts',
    foreignKeyColumns: [],
  },
  {
    tableName: 'validation',
    modelName: 'validation',
    foreignKeyColumns: [],
  },
  {
    tableName: 'processing_error',
    modelName: 'processingError',
    foreignKeyColumns: [],
  },
  {
    tableName: 'llm_interaction',
    modelName: 'lLMInteraction',
    foreignKeyColumns: [],
  },
];

async function migrateTable(table: TableMigration): Promise<void> {
  console.log(`\n🔄 Migrating table: ${table.tableName}`);
  
  // Get all records
  const records = await (prisma as any)[table.modelName].findMany({
    select: { id: true },
    orderBy: { id: 'asc' },
  });

  if (records.length === 0) {
    console.log(`   ⏭️  No records to migrate`);
    return;
  }

  console.log(`   📊 Found ${records.length} records`);

  // Create ID mapping: old UUID -> new short ID
  const idMapping = new Map<string, string>();

  // Generate new IDs for all records
  for (const record of records) {
    const newId = await generateShortId(table.tableName);
    idMapping.set(record.id, newId);
  }

  console.log(`   ✅ Generated ${idMapping.size} new IDs`);

  // Update records in transaction
  await prisma.$transaction(async (tx) => {
    // Step 1: Update primary keys in the table itself FIRST
    console.log(`   🔑 Updating primary keys in ${table.tableName}`);
    const quotedTableName = `"${table.tableName}"`;
    for (const [oldId, newId] of idMapping.entries()) {
      await (tx as any).$executeRawUnsafe(
        `UPDATE ${quotedTableName} SET id = $1 WHERE id = $2`,
        newId,
        oldId
      );
    }

    // Step 2: Update foreign keys in dependent tables AFTER primary keys are updated
    for (const fk of table.foreignKeyColumns) {
      console.log(`   🔗 Updating foreign keys in ${fk.table} (${fk.column})`);
      const quotedFkTable = `"${fk.table}"`;
      const quotedFkColumn = `"${fk.column}"`;
      
      for (const [oldId, newId] of idMapping.entries()) {
        await (tx as any).$executeRawUnsafe(
          `UPDATE ${quotedFkTable} SET ${quotedFkColumn} = $1 WHERE ${quotedFkColumn} = $2`,
          newId,
          oldId
        );
      }
    }
  });

  console.log(`   ✅ Migration completed for ${table.tableName}`);
}

async function main() {
  console.log('🚀 Starting UUID to Short ID migration...\n');

  try {
    // Initialize counters for all tables
    console.log('📝 Initializing counters...');
    for (const table of TABLES_TO_MIGRATE) {
      await initializeCounter(table.tableName, 0);
    }
    console.log('✅ Counters initialized\n');

    // Migrate tables in order (respecting foreign key dependencies)
    for (const table of TABLES_TO_MIGRATE) {
      await migrateTable(table);
    }

    console.log('\n🎉 Migration completed successfully!');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });




