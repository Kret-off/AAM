/**
 * Service Availability Checker
 * Checks connectivity and authentication for all external services
 */

import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { S3Client, HeadBucketCommand, CreateBucketCommand } from '@aws-sdk/client-s3';
import { createClient } from '@deepgram/sdk';
import OpenAI from 'openai';

interface ServiceCheckResult {
  name: string;
  status: 'success' | 'error';
  message: string;
  details?: string;
}

const results: ServiceCheckResult[] = [];

/**
 * Check PostgreSQL database
 */
async function checkPostgreSQL(): Promise<ServiceCheckResult> {
  try {
    const prisma = new PrismaClient();
    await prisma.$queryRaw`SELECT 1`;
    await prisma.$disconnect();
    
    return {
      name: 'PostgreSQL',
      status: 'success',
      message: '✅ Database connection successful',
    };
  } catch (error) {
    return {
      name: 'PostgreSQL',
      status: 'error',
      message: '❌ Database connection failed',
      details: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Check Redis connection
 */
async function checkRedis(): Promise<ServiceCheckResult> {
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const redis = new Redis(redisUrl);
    
    const result = await redis.ping();
    redis.disconnect();
    
    if (result === 'PONG') {
      return {
        name: 'Redis',
        status: 'success',
        message: '✅ Redis connection successful',
      };
    } else {
      return {
        name: 'Redis',
        status: 'error',
        message: '❌ Redis ping returned unexpected result',
      };
    }
  } catch (error) {
    return {
      name: 'Redis',
      status: 'error',
      message: '❌ Redis connection failed',
      details: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Check MinIO/S3 storage
 */
async function checkS3(): Promise<ServiceCheckResult> {
  try {
    const endpoint = process.env.S3_ENDPOINT;
    const region = process.env.S3_REGION || 'us-east-1';
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
    const bucketName = process.env.S3_BUCKET_NAME;

    if (!endpoint || !accessKeyId || !secretAccessKey || !bucketName) {
      return {
        name: 'MinIO/S3',
        status: 'error',
        message: '❌ S3 configuration incomplete',
        details: 'Missing required environment variables: S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, or S3_BUCKET_NAME',
      };
    }

    const s3Client = new S3Client({
      endpoint,
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: true,
    });

    // Try to check if bucket exists
    try {
      const command = new HeadBucketCommand({ Bucket: bucketName });
      await s3Client.send(command);
      
      return {
        name: 'MinIO/S3',
        status: 'success',
        message: `✅ S3 connection successful (bucket: ${bucketName} exists)`,
      };
    } catch (headError: unknown) {
      // If bucket doesn't exist, try to create it
      if (headError && typeof headError === 'object' && 'name' in headError && headError.name === 'NotFound') {
        try {
          const createCommand = new CreateBucketCommand({ Bucket: bucketName });
          await s3Client.send(createCommand);
          
          return {
            name: 'MinIO/S3',
            status: 'success',
            message: `✅ S3 connection successful (bucket: ${bucketName} created)`,
          };
        } catch (createError) {
          return {
            name: 'MinIO/S3',
            status: 'error',
            message: '❌ S3 connection failed - bucket does not exist and could not be created',
            details: createError instanceof Error 
              ? `${createError.message} (endpoint: ${endpoint})`
              : String(createError),
          };
        }
      }
      
      // Other errors (connection, auth, etc.)
      const errorMessage = headError instanceof Error ? headError.message : String(headError);
      const errorName = headError && typeof headError === 'object' && 'name' in headError 
        ? String(headError.name) 
        : 'Unknown';
      
      return {
        name: 'MinIO/S3',
        status: 'error',
        message: '❌ S3 connection failed',
        details: `${errorName}: ${errorMessage} (endpoint: ${endpoint})`,
      };
    }
  } catch (error) {
    return {
      name: 'MinIO/S3',
      status: 'error',
      message: '❌ S3 connection failed',
      details: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Check Deepgram API
 */
async function checkDeepgram(): Promise<ServiceCheckResult> {
  try {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    
    if (!apiKey) {
      return {
        name: 'Deepgram API',
        status: 'error',
        message: '❌ Deepgram API key not configured',
        details: 'DEEPGRAM_API_KEY environment variable is not set. Please add it to your .env file.',
      };
    }

    // Validate API key format - just check it's not empty
    const trimmedKey = apiKey.trim();
    if (!trimmedKey || trimmedKey.length < 10) {
      return {
        name: 'Deepgram API',
        status: 'error',
        message: '❌ Deepgram API key appears invalid',
        details: 'DEEPGRAM_API_KEY is too short or empty. Please check your .env file.',
      };
    }

    // Check for hidden characters (whitespace, newlines, etc.)
    const hasWhitespace = trimmedKey !== apiKey || /\s/.test(trimmedKey);
    if (hasWhitespace) {
      console.warn(`[Deepgram] Warning: API key contains whitespace. Length: ${apiKey.length}, Trimmed length: ${trimmedKey.length}`);
    }
    
    // Try to create a client and make a simple request to validate the key
    const deepgram = createClient(trimmedKey);
    
    // Check if we can list projects (lightweight operation)
    const { result, error } = await deepgram.manage.getProjects();
    
    if (error) {
      const errorCode = (error as any).code || 'Unknown';
      const errorMessage = error.message || 'Unknown error';
      const requestId = (error as any).request_id || 'N/A';
      const isAuthError = errorCode === 'INVALID_AUTH' || 
        errorMessage.toLowerCase().includes('invalid credentials') ||
        errorMessage.toLowerCase().includes('authentication') ||
        errorMessage.toLowerCase().includes('unauthorized');
      
      // Build diagnostic info (without exposing the key)
      const diagnosticInfo = [
        `Key length: ${trimmedKey.length} characters`,
        hasWhitespace ? '⚠️ Key contains whitespace (trimmed)' : '✅ No whitespace detected',
        `Error code: ${errorCode}`,
        `Request ID: ${requestId}`,
      ].join(', ');
      
      return {
        name: 'Deepgram API',
        status: 'error',
        message: '❌ Deepgram API authentication failed',
        details: isAuthError 
          ? `Invalid API credentials. ${diagnosticInfo}. Please verify your DEEPGRAM_API_KEY in .env file is correct and has not expired. Get a new key from https://console.deepgram.com/`
          : `API error: ${errorMessage} (Code: ${errorCode}, Request ID: ${requestId}). ${diagnosticInfo}`,
      };
    }

    return {
      name: 'Deepgram API',
      status: 'success',
      message: '✅ Deepgram API key valid',
    };
  } catch (error) {
    return {
      name: 'Deepgram API',
      status: 'error',
      message: '❌ Deepgram API check failed',
      details: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Check OpenAI API
 */
async function checkOpenAI(): Promise<ServiceCheckResult> {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      return {
        name: 'OpenAI API',
        status: 'error',
        message: '❌ OpenAI API key not configured',
        details: 'OPENAI_API_KEY environment variable is not set',
      };
    }

    const openai = new OpenAI({ apiKey });
    
    // Make a simple API call to validate the key
    const response = await openai.models.list();
    
    return {
      name: 'OpenAI API',
      status: 'success',
      message: '✅ OpenAI API key valid',
    };
  } catch (error) {
    return {
      name: 'OpenAI API',
      status: 'error',
      message: '❌ OpenAI API check failed',
      details: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Main function
 */
async function main() {
  console.log('\n🔍 Checking service availability...\n');
  console.log('=' .repeat(60));
  
  // Run all checks
  results.push(await checkPostgreSQL());
  results.push(await checkRedis());
  results.push(await checkS3());
  results.push(await checkDeepgram());
  results.push(await checkOpenAI());
  
  // Print results
  console.log('\n📊 Results:\n');
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const result of results) {
    console.log(`${result.message}`);
    if (result.details) {
      console.log(`   ${result.details}`);
    }
    console.log();
    
    if (result.status === 'success') {
      successCount++;
    } else {
      errorCount++;
    }
  }
  
  console.log('='.repeat(60));
  console.log(`\n✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${errorCount}`);
  console.log(`📋 Total: ${results.length}\n`);
  
  // Exit with error code if any checks failed
  if (errorCount > 0) {
    process.exit(1);
  }
}

// Run checks
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

