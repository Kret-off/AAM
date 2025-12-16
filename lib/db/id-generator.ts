/**
 * ID Generator for short IDs with table prefix
 * Format: {prefix}{number} (e.g., "usr1", "cli42", "met100")
 */

import { prisma } from '../prisma';

/**
 * Table name to prefix mapping
 */
const TABLE_PREFIXES: Record<string, string> = {
  user: 'usr',
  client: 'cli',
  meeting_type: 'mty',
  prompt_scenario: 'scn',
  directory_participant: 'par',
  meeting: 'met',
  upload_blob: 'upl',
  transcript: 'trs',
  artifacts: 'art',
  validation: 'val',
  processing_error: 'err',
  llm_interaction: 'llm',
} as const;

// Cache to track if table exists check has been done
let tableExistsChecked = false;

/**
 * Ensure id_sequence table exists
 */
async function ensureIdSequenceTable(): Promise<void> {
  if (tableExistsChecked) {
    return;
  }

  try {
    // Try to query the table to see if it exists
    await prisma.$queryRawUnsafe(`SELECT 1 FROM id_sequence LIMIT 1`);
    tableExistsChecked = true;
  } catch (error) {
    // Table doesn't exist, create it
    console.log('Creating id_sequence table...');
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "id_sequence" (
          "table_name" TEXT NOT NULL,
          "current_value" BIGINT NOT NULL DEFAULT 0,
          CONSTRAINT "id_sequence_pkey" PRIMARY KEY ("table_name")
        );
      `);
      
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "id_sequence_table_name_idx" ON "id_sequence"("table_name");
      `);
      
      tableExistsChecked = true;
      console.log('✅ id_sequence table created');
    } catch (createError) {
      console.error('Failed to create id_sequence table:', createError);
      throw new Error(`Failed to create id_sequence table: ${createError instanceof Error ? createError.message : 'Unknown error'}`);
    }
  }
}

/**
 * Generate a short ID for a given table name
 * Format: {prefix}{number}
 * 
 * This function atomically increments the counter for the table
 * and returns the next ID in the sequence.
 * 
 * @param tableName - The database table name (as mapped in Prisma schema)
 * @returns Promise<string> - The generated short ID (e.g., "usr1", "cli42")
 */
export async function generateShortId(tableName: string): Promise<string> {
  const prefix = TABLE_PREFIXES[tableName];
  
  if (!prefix) {
    throw new Error(`No prefix defined for table: ${tableName}`);
  }

  // Ensure table exists before trying to use it
  await ensureIdSequenceTable();

  try {
    // Atomically increment the counter and get the next value
    // Using raw SQL for atomic operation
    const result = await prisma.$queryRawUnsafe<Array<{ current_value: bigint }>>(
      `INSERT INTO id_sequence (table_name, current_value)
       VALUES ($1, 1)
       ON CONFLICT (table_name)
       DO UPDATE SET current_value = id_sequence.current_value + 1
       RETURNING current_value;`,
      tableName
    );

    if (!result || result.length === 0) {
      throw new Error(`Failed to generate ID for table: ${tableName} - no result returned`);
    }

    const nextValue = Number(result[0].current_value);
    if (isNaN(nextValue) || nextValue <= 0) {
      throw new Error(`Invalid counter value for table: ${tableName} - got ${nextValue}`);
    }

    return `${prefix}${nextValue}`;
  } catch (error) {
    console.error(`Error generating ID for table ${tableName}:`, error);
    // Re-throw with more context
    if (error instanceof Error) {
      throw new Error(`Failed to generate ID for table ${tableName}: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Initialize counter for a table if it doesn't exist
 * This is useful for migration scripts
 */
export async function initializeCounter(
  tableName: string,
  initialValue: number = 0
): Promise<void> {
  // Ensure table exists before trying to use it
  await ensureIdSequenceTable();
  
  await prisma.$executeRawUnsafe(
    `INSERT INTO id_sequence (table_name, current_value)
     VALUES ($1, $2)
     ON CONFLICT (table_name) DO NOTHING;`,
    tableName,
    initialValue
  );
}

/**
 * Get current counter value for a table
 */
export async function getCurrentCounter(tableName: string): Promise<number> {
  // Ensure table exists before trying to use it
  await ensureIdSequenceTable();
  
  const result = await prisma.$queryRawUnsafe<Array<{ current_value: bigint | null }>>(
    `SELECT current_value FROM id_sequence WHERE table_name = $1;`,
    tableName
  );

  if (!result || result.length === 0 || result[0].current_value === null) {
    return 0;
  }

  return Number(result[0].current_value);
}

/**
 * Sync counter with existing data in the table
 * Finds the maximum existing ID and sets counter to that value
 */
export async function syncCounterWithExistingData(tableName: string): Promise<void> {
  const prefix = TABLE_PREFIXES[tableName];
  if (!prefix) {
    throw new Error(`No prefix defined for table: ${tableName}`);
  }

  try {
    // Get all existing IDs for this table
    const modelName = tableName === 'meeting_type' ? 'meetingType' :
                     tableName === 'prompt_scenario' ? 'promptScenario' :
                     tableName === 'directory_participant' ? 'directoryParticipant' :
                     tableName === 'upload_blob' ? 'uploadBlob' :
                     tableName === 'llm_interaction' ? 'lLMInteraction' :
                     tableName === 'processing_error' ? 'processingError' :
                     tableName;
    
    const records = await (prisma as any)[modelName].findMany({
      select: { id: true },
    });

    // Find maximum short ID number
    const prefixRegex = new RegExp(`^${prefix}(\\d+)$`);
    let maxNumber = 0;
    
    for (const record of records) {
      const match = record.id.match(prefixRegex);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNumber) {
          maxNumber = num;
        }
      }
    }

    // Update counter to max number (next ID will be maxNumber + 1)
    if (maxNumber > 0) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO id_sequence (table_name, current_value)
         VALUES ($1, $2)
         ON CONFLICT (table_name)
         DO UPDATE SET current_value = $2;`,
        tableName,
        maxNumber
      );
      console.log(`Synced counter for ${tableName} to ${maxNumber}`);
    }
  } catch (error) {
    console.error(`Error syncing counter for ${tableName}:`, error);
    // Don't throw - this is a best-effort sync
  }
}




