/**
 * Full System Cleanup Script
 * Comprehensive cleanup of Database, S3 Storage, and Redis Queue
 * 
 * Usage:
 *   npx tsx scripts/full-system-cleanup.ts [options]
 * 
 * Options:
 *   --all                Delete all clients, meetings, and related data (default)
 *   --client <id>        Delete specific client and its meetings
 *   --confirm            Skip confirmation prompt
 *   --dry-run            Show what would be deleted without actually deleting
 * 
 * What it cleans:
 *   - Database: Clients, Meetings, and all related records
 *   - S3/MinIO: All uploaded audio files
 *   - Redis: All job queues and meeting locks
 * 
 * What it keeps:
 *   - Users
 *   - MeetingTypes
 *   - PromptScenarios
 *   - DirectoryParticipants
 */

import { PrismaClient } from '@prisma/client';
import { S3Client, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import Redis from 'ioredis';
import { getProcessingQueue } from '../lib/orchestrator/queue';

const prisma = new PrismaClient();

// ============================================================================
// TYPES
// ============================================================================

interface CleanupOptions {
  all: boolean;
  clientId?: string;
  confirm: boolean;
  dryRun: boolean;
}

interface Statistics {
  database: {
    clients: number;
    meetings: number;
    meetingParticipants: number;
    meetingViewers: number;
    uploadBlobs: number;
    transcripts: number;
    artifacts: number;
    validations: number;
    processingErrors: number;
    llmInteractions: number;
    // Keep these
    users: number;
    meetingTypes: number;
    scenarios: number;
    directoryParticipants: number;
  };
  s3: {
    totalFiles: number;
    totalSize: number;
  };
  redis: {
    locks: number;
    completedJobs: number;
    failedJobs: number;
    activeJobs: number;
    waitingJobs: number;
    delayedJobs: number;
  };
}

interface CleanupResult {
  database: {
    clientsDeleted: number;
    meetingsDeleted: number;
  };
  s3: {
    filesDeleted: number;
    errors: number;
  };
  redis: {
    locksCleared: number;
    jobsCleared: number;
  };
}

// ============================================================================
// S3 CLIENT
// ============================================================================

function getS3Client(): S3Client {
  const endpoint = process.env.S3_ENDPOINT;
  const region = process.env.S3_REGION || 'us-east-1';
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error('S3 configuration is missing. Please check environment variables.');
  }

  return new S3Client({
    endpoint,
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    forcePathStyle: true,
  });
}

// ============================================================================
// REDIS CLIENT
// ============================================================================

function getRedisClient(): Redis {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  return new Redis(redisUrl, {
    maxRetriesPerRequest: null,
  });
}

// ============================================================================
// STATISTICS FUNCTIONS
// ============================================================================

async function getStatistics(options: CleanupOptions): Promise<Statistics> {
  console.log('📊 Gathering statistics...\n');

  // Database statistics
  const dbStats = await getDatabaseStatistics(options);
  
  // S3 statistics
  const s3Stats = await getS3Statistics(options);
  
  // Redis statistics
  const redisStats = await getRedisStatistics();

  return {
    database: dbStats,
    s3: s3Stats,
    redis: redisStats,
  };
}

async function getDatabaseStatistics(options: CleanupOptions) {
  const whereClause = options.clientId ? { id: options.clientId } : {};
  
  // Count entities to be deleted
  const clients = await prisma.client.count({ where: whereClause });
  const meetings = await prisma.meeting.count({
    where: options.clientId ? { clientId: options.clientId } : {},
  });

  // Related entities (will be cascade deleted)
  const meetingParticipants = await prisma.meetingParticipant.count({
    where: options.clientId
      ? { meeting: { clientId: options.clientId } }
      : {},
  });
  
  const meetingViewers = await prisma.meetingViewer.count({
    where: options.clientId
      ? { meeting: { clientId: options.clientId } }
      : {},
  });
  
  const uploadBlobs = await prisma.uploadBlob.count({
    where: options.clientId
      ? { meeting: { clientId: options.clientId } }
      : {},
  });
  
  const transcripts = await prisma.transcript.count({
    where: options.clientId
      ? { meeting: { clientId: options.clientId } }
      : {},
  });
  
  const artifacts = await prisma.artifacts.count({
    where: options.clientId
      ? { meeting: { clientId: options.clientId } }
      : {},
  });
  
  const validations = await prisma.validation.count({
    where: options.clientId
      ? { meeting: { clientId: options.clientId } }
      : {},
  });
  
  const processingErrors = await prisma.processingError.count({
    where: options.clientId
      ? { meeting: { clientId: options.clientId } }
      : {},
  });

  let llmInteractions = 0;
  try {
    const llmModel = (prisma as any).lLMInteraction || (prisma as any).llmInteraction;
    if (llmModel) {
      llmInteractions = await llmModel.count({
        where: options.clientId
          ? { meeting: { clientId: options.clientId } }
          : {},
      });
    }
  } catch (e) {
    // Model might not exist
  }

  // Entities to keep
  const users = await prisma.user.count();
  const meetingTypes = await prisma.meetingType.count();
  const scenarios = await prisma.promptScenario.count();
  const directoryParticipants = await prisma.directoryParticipant.count();

  return {
    clients,
    meetings,
    meetingParticipants,
    meetingViewers,
    uploadBlobs,
    transcripts,
    artifacts,
    validations,
    processingErrors,
    llmInteractions,
    users,
    meetingTypes,
    scenarios,
    directoryParticipants,
  };
}

async function getS3Statistics(options: CleanupOptions): Promise<{ totalFiles: number; totalSize: number }> {
  try {
    const s3Client = getS3Client();
    const bucketName = process.env.S3_BUCKET_NAME;

    if (!bucketName) {
      console.warn('⚠️  S3_BUCKET_NAME not set, skipping S3 statistics');
      return { totalFiles: 0, totalSize: 0 };
    }

    // Get upload blobs from database to count files
    const uploadBlobs = await prisma.uploadBlob.findMany({
      where: options.clientId
        ? { meeting: { clientId: options.clientId } }
        : {},
      select: {
        storagePath: true,
        sizeBytes: true,
        deletedAt: true,
      },
    });

    const activeBlobs = uploadBlobs.filter((blob) => !blob.deletedAt);
    const totalSize = activeBlobs.reduce((sum, blob) => sum + Number(blob.sizeBytes), 0);

    return {
      totalFiles: activeBlobs.length,
      totalSize,
    };
  } catch (error) {
    console.warn('⚠️  Error getting S3 statistics:', error);
    return { totalFiles: 0, totalSize: 0 };
  }
}

async function getRedisStatistics() {
  try {
    const redis = getRedisClient();
    const queue = getProcessingQueue();

    // Count locks
    const lockKeys = await redis.keys('lock:meeting:*');
    const locks = lockKeys.length;

    // Count jobs
    const completedJobs = await queue.getCompletedCount();
    const failedJobs = await queue.getFailedCount();
    const activeJobs = await queue.getActiveCount();
    const waitingJobs = await queue.getWaitingCount();
    const delayedJobs = await queue.getDelayedCount();

    await redis.quit();

    return {
      locks,
      completedJobs,
      failedJobs,
      activeJobs,
      waitingJobs,
      delayedJobs,
    };
  } catch (error) {
    console.warn('⚠️  Error getting Redis statistics:', error);
    return {
      locks: 0,
      completedJobs: 0,
      failedJobs: 0,
      activeJobs: 0,
      waitingJobs: 0,
      delayedJobs: 0,
    };
  }
}

// ============================================================================
// DISPLAY FUNCTIONS
// ============================================================================

function displayStatistics(stats: Statistics, title: string) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`📊 ${title}`);
  console.log(`${'='.repeat(70)}\n`);

  console.log('🗄️  DATABASE:');
  console.log('   To be DELETED:');
  console.log(`      Clients:             ${stats.database.clients}`);
  console.log(`      Meetings:            ${stats.database.meetings}`);
  console.log(`      MeetingParticipants: ${stats.database.meetingParticipants}`);
  console.log(`      MeetingViewers:      ${stats.database.meetingViewers}`);
  console.log(`      UploadBlobs:         ${stats.database.uploadBlobs}`);
  console.log(`      Transcripts:         ${stats.database.transcripts}`);
  console.log(`      Artifacts:           ${stats.database.artifacts}`);
  console.log(`      Validations:         ${stats.database.validations}`);
  console.log(`      ProcessingErrors:    ${stats.database.processingErrors}`);
  console.log(`      LLMInteractions:     ${stats.database.llmInteractions}`);
  
  console.log('\n   To be KEPT:');
  console.log(`      Users:               ${stats.database.users}`);
  console.log(`      MeetingTypes:        ${stats.database.meetingTypes}`);
  console.log(`      PromptScenarios:     ${stats.database.scenarios}`);
  console.log(`      DirectoryParticipants: ${stats.database.directoryParticipants}`);

  console.log('\n📁 S3 STORAGE:');
  console.log(`   Files to delete:     ${stats.s3.totalFiles}`);
  console.log(`   Total size:          ${formatBytes(stats.s3.totalSize)}`);

  console.log('\n🔴 REDIS:');
  console.log(`   Meeting locks:       ${stats.redis.locks}`);
  console.log(`   Completed jobs:      ${stats.redis.completedJobs}`);
  console.log(`   Failed jobs:         ${stats.redis.failedJobs}`);
  console.log(`   Active jobs:         ${stats.redis.activeJobs}`);
  console.log(`   Waiting jobs:        ${stats.redis.waitingJobs}`);
  console.log(`   Delayed jobs:        ${stats.redis.delayedJobs}`);
  
  const totalJobs = stats.redis.completedJobs + stats.redis.failedJobs + 
                    stats.redis.activeJobs + stats.redis.waitingJobs + stats.redis.delayedJobs;
  console.log(`   Total jobs:          ${totalJobs}`);

  console.log(`\n${'='.repeat(70)}\n`);
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

// ============================================================================
// CLEANUP FUNCTIONS
// ============================================================================

async function clearRedisLocks(options: CleanupOptions): Promise<number> {
  console.log('🔓 Clearing Redis locks...');
  
  if (options.dryRun) {
    console.log('   [DRY RUN] Would clear locks');
    const redis = getRedisClient();
    const lockKeys = await redis.keys('lock:meeting:*');
    await redis.quit();
    return lockKeys.length;
  }

  try {
    const redis = getRedisClient();
    const lockKeys = await redis.keys('lock:meeting:*');
    
    if (lockKeys.length === 0) {
      console.log('   No locks to clear');
      await redis.quit();
      return 0;
    }

    await redis.del(...lockKeys);
    console.log(`   ✅ Cleared ${lockKeys.length} lock(s)`);
    await redis.quit();
    return lockKeys.length;
  } catch (error) {
    console.error('   ❌ Error clearing locks:', error);
    return 0;
  }
}

async function clearRedisJobs(options: CleanupOptions): Promise<number> {
  console.log('\n🗑️  Clearing Redis job queues...');
  
  try {
    const queue = getProcessingQueue();
    let totalCleared = 0;

    // Get all job types
    const completed = await queue.getCompleted(0, -1);
    const failed = await queue.getFailed(0, -1);
    const active = await queue.getActive(0, -1);
    const waiting = await queue.getWaiting(0, -1);
    const delayed = await queue.getDelayed(0, -1);

    const allJobs = [...completed, ...failed, ...active, ...waiting, ...delayed];

    console.log(`   Found ${allJobs.length} job(s) to clear`);

    if (options.dryRun) {
      console.log('   [DRY RUN] Would clear all jobs');
      await queue.close();
      return allJobs.length;
    }

    if (allJobs.length === 0) {
      console.log('   No jobs to clear');
      await queue.close();
      return 0;
    }

    // Remove all jobs
    for (const job of allJobs) {
      try {
        await job.remove();
        totalCleared++;
      } catch (error) {
        console.error(`   ⚠️  Failed to remove job ${job.id}:`, error);
      }
    }

    console.log(`   ✅ Cleared ${totalCleared} job(s)`);
    await queue.close();
    return totalCleared;
  } catch (error) {
    console.error('   ❌ Error clearing jobs:', error);
    return 0;
  }
}

async function deleteFilesFromS3(
  options: CleanupOptions
): Promise<{ deleted: number; errors: number }> {
  console.log('\n📁 Deleting files from S3...');
  
  let deleted = 0;
  let errors = 0;

  try {
    const uploadBlobs = await prisma.uploadBlob.findMany({
      where: {
        ...(options.clientId ? { meeting: { clientId: options.clientId } } : {}),
        deletedAt: null,
      },
      select: {
        id: true,
        storagePath: true,
      },
    });

    if (uploadBlobs.length === 0) {
      console.log('   No files to delete');
      return { deleted: 0, errors: 0 };
    }

    console.log(`   Found ${uploadBlobs.length} file(s) to delete`);

    if (options.dryRun) {
      console.log('   [DRY RUN] Would delete files from S3');
      return { deleted: uploadBlobs.length, errors: 0 };
    }

    const s3Client = getS3Client();
    const bucketName = process.env.S3_BUCKET_NAME;

    if (!bucketName) {
      console.warn('   ⚠️  S3_BUCKET_NAME not set, skipping file deletion');
      return { deleted: 0, errors: uploadBlobs.length };
    }

    for (const blob of uploadBlobs) {
      try {
        await s3Client.send(
          new DeleteObjectCommand({
            Bucket: bucketName,
            Key: blob.storagePath,
          })
        );
        deleted++;
      } catch (error) {
        console.error(`   ⚠️  Failed to delete ${blob.storagePath}:`, error);
        errors++;
      }
    }

    console.log(`   ✅ Deleted ${deleted} file(s) from S3`);
    if (errors > 0) {
      console.log(`   ⚠️  ${errors} file(s) failed to delete`);
    }

    return { deleted, errors };
  } catch (error) {
    console.error('   ❌ Error deleting files from S3:', error);
    return { deleted, errors: errors + 1 };
  }
}

async function deleteFromDatabase(
  options: CleanupOptions
): Promise<{ clientsDeleted: number; meetingsDeleted: number }> {
  console.log('\n🗄️  Deleting from database...');

  if (options.dryRun) {
    const clientCount = await prisma.client.count({
      where: options.clientId ? { id: options.clientId } : {},
    });
    const meetingCount = await prisma.meeting.count({
      where: options.clientId ? { clientId: options.clientId } : {},
    });
    console.log('   [DRY RUN] Would delete:');
    console.log(`      Meetings: ${meetingCount}`);
    console.log(`      Clients:  ${clientCount}`);
    return { clientsDeleted: clientCount, meetingsDeleted: meetingCount };
  }

  try {
    // Delete meetings (cascade will handle related records)
    console.log('   Deleting meetings (cascade deletes related records)...');
    const meetingsResult = await prisma.meeting.deleteMany({
      where: options.clientId ? { clientId: options.clientId } : {},
    });
    console.log(`   ✅ Deleted ${meetingsResult.count} meeting(s)`);

    // Delete clients
    console.log('   Deleting clients...');
    const clientsResult = await prisma.client.deleteMany({
      where: options.clientId ? { id: options.clientId } : {},
    });
    console.log(`   ✅ Deleted ${clientsResult.count} client(s)`);

    return {
      clientsDeleted: clientsResult.count,
      meetingsDeleted: meetingsResult.count,
    };
  } catch (error) {
    console.error('   ❌ Error deleting from database:', error);
    throw error;
  }
}

// ============================================================================
// VERIFICATION
// ============================================================================

async function verifyCleanup(options: CleanupOptions): Promise<boolean> {
  console.log('\n🔍 Verifying cleanup...');

  const stats = await getStatistics(options);

  const totalToDelete =
    stats.database.clients +
    stats.database.meetings +
    stats.database.meetingParticipants +
    stats.database.meetingViewers +
    stats.database.uploadBlobs +
    stats.database.transcripts +
    stats.database.artifacts +
    stats.database.validations +
    stats.database.processingErrors +
    stats.database.llmInteractions;

  const allClean = totalToDelete === 0;

  if (allClean) {
    console.log('   ✅ All targeted data has been successfully cleaned!');
  } else {
    console.log('   ⚠️  Warning: Some records may still exist:');
    if (stats.database.clients > 0) console.log(`      Clients: ${stats.database.clients}`);
    if (stats.database.meetings > 0) console.log(`      Meetings: ${stats.database.meetings}`);
  }

  return allClean;
}

// ============================================================================
// MAIN
// ============================================================================

async function parseOptions(): Promise<CleanupOptions> {
  const args = process.argv.slice(2);
  
  const options: CleanupOptions = {
    all: true,
    confirm: args.includes('--confirm'),
    dryRun: args.includes('--dry-run'),
  };

  // Check for --client flag
  const clientIndex = args.indexOf('--client');
  if (clientIndex !== -1 && args[clientIndex + 1]) {
    options.clientId = args[clientIndex + 1];
    options.all = false;
  }

  return options;
}

async function main() {
  console.log('\n🧹 FULL SYSTEM CLEANUP\n');
  console.log('This script will clean:');
  console.log('  - Database: Clients, Meetings, and all related records');
  console.log('  - S3 Storage: All uploaded audio files');
  console.log('  - Redis: All job queues and meeting locks\n');

  try {
    // Parse options
    const options = await parseOptions();

    if (options.dryRun) {
      console.log('🔍 DRY RUN MODE - No data will be deleted\n');
    }

    if (options.clientId) {
      console.log(`🎯 Target: Client ${options.clientId}\n`);
    } else {
      console.log(`🎯 Target: ALL clients and meetings\n`);
    }

    // Get statistics before cleanup
    const statsBefore = await getStatistics(options);
    displayStatistics(statsBefore, 'BEFORE CLEANUP');

    // Check if there's anything to delete
    const totalToDelete =
      statsBefore.database.clients +
      statsBefore.database.meetings +
      statsBefore.s3.totalFiles +
      statsBefore.redis.locks +
      statsBefore.redis.completedJobs +
      statsBefore.redis.failedJobs;

    if (totalToDelete === 0) {
      console.log('✅ Nothing to delete. System is already clean.\n');
      return;
    }

    // Confirmation
    if (!options.confirm && !options.dryRun) {
      console.log('⚠️  WARNING: This action cannot be undone!');
      console.log('   To proceed without confirmation, use: --confirm flag');
      console.log('   To see what would be deleted, use: --dry-run flag\n');
      console.log('   Exiting without changes.\n');
      return;
    }

    if (!options.dryRun) {
      console.log('🗑️  STARTING CLEANUP PROCESS...\n');
    }

    // Perform cleanup
    const result: CleanupResult = {
      database: { clientsDeleted: 0, meetingsDeleted: 0 },
      s3: { filesDeleted: 0, errors: 0 },
      redis: { locksCleared: 0, jobsCleared: 0 },
    };

    // Step 1: Clear Redis locks (only when cleaning all, not specific client)
    if (!options.clientId) {
      result.redis.locksCleared = await clearRedisLocks(options);
    } else {
      console.log('\n🔓 Skipping Redis locks cleanup (specific client mode)');
    }

    // Step 2: Clear Redis jobs (only when cleaning all, not specific client)
    if (!options.clientId) {
      result.redis.jobsCleared = await clearRedisJobs(options);
    } else {
      console.log('🗑️  Skipping Redis jobs cleanup (specific client mode)');
    }

    // Step 3: Delete files from S3
    const s3Result = await deleteFilesFromS3(options);
    result.s3.filesDeleted = s3Result.deleted;
    result.s3.errors = s3Result.errors;

    // Step 4: Delete from database
    const dbResult = await deleteFromDatabase(options);
    result.database = dbResult;

    // Display results
    console.log('\n' + '='.repeat(70));
    console.log('📊 CLEANUP RESULTS');
    console.log('='.repeat(70) + '\n');
    console.log('🗄️  Database:');
    console.log(`   Meetings deleted:    ${result.database.meetingsDeleted}`);
    console.log(`   Clients deleted:     ${result.database.clientsDeleted}`);
    console.log('\n📁 S3 Storage:');
    console.log(`   Files deleted:       ${result.s3.filesDeleted || 0}`);
    if (result.s3.errors > 0) {
      console.log(`   Errors:              ${result.s3.errors}`);
    }
    console.log('\n🔴 Redis:');
    console.log(`   Locks cleared:       ${result.redis.locksCleared}`);
    console.log(`   Jobs cleared:        ${result.redis.jobsCleared}`);
    console.log('\n' + '='.repeat(70) + '\n');

    if (!options.dryRun) {
      // Verify cleanup
      const isClean = await verifyCleanup(options);

      if (isClean) {
        console.log('✅ CLEANUP COMPLETED SUCCESSFULLY!\n');
      } else {
        console.log('⚠️  CLEANUP COMPLETED WITH WARNINGS\n');
      }

      // Show final statistics
      const statsAfter = await getStatistics(options);
      displayStatistics(statsAfter, 'AFTER CLEANUP');
    } else {
      console.log('🔍 DRY RUN COMPLETED - No data was actually deleted\n');
    }
  } catch (error) {
    console.error('\n❌ CLEANUP FAILED:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
main()
  .then(() => {
    console.log('✨ Script completed.\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });

