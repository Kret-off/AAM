/**
 * Initialize ID sequence counters for all tables
 * 
 * This script initializes counters in id_sequence table for all tables
 * that use short IDs. Counters are set based on existing data.
 * 
 * Usage:
 *   npx tsx scripts/init-id-counters.ts
 */

import { PrismaClient } from '@prisma/client';
import { initializeCounter, getCurrentCounter, syncCounterWithExistingData } from '../lib/db/id-generator';

const prisma = new PrismaClient();

const TABLES = [
  'user',
  'client',
  'meeting_type',
  'prompt_scenario',
  'directory_participant',
  'meeting',
  'upload_blob',
  'transcript',
  'artifacts',
  'validation',
  'processing_error',
  'llm_interaction',
];

async function main() {
  console.log('🚀 Initializing ID sequence counters...\n');

  try {
    for (const tableName of TABLES) {
      // Initialize counter to 0 if it doesn't exist
      await initializeCounter(tableName, 0);
      
      // Sync counter with existing data
      await syncCounterWithExistingData(tableName);
      
      const current = await getCurrentCounter(tableName);
      console.log(`✅ ${tableName}: counter initialized (current: ${current})`);
    }

    console.log('\n🎉 All counters initialized and synced successfully!');
  } catch (error) {
    console.error('\n❌ Initialization failed:', error);
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




