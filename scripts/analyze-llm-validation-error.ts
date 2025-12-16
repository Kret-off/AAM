/**
 * Script to analyze LLM validation error for a meeting
 * Usage: npx tsx scripts/analyze-llm-validation-error.ts <meetingId>
 */

import { PrismaClient } from '@prisma/client';
import { validateLLMResponse, extractJSONFromResponse } from '@/lib/openai-adapter/validation';

const prisma = new PrismaClient();

async function analyzeLLMValidationError(meetingId: string) {
  console.log(`\n🔍 Analyzing LLM validation error for meeting: ${meetingId}\n`);

  try {
    // Get meeting with all relations
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        scenario: {
          select: {
            id: true,
            name: true,
            outputSchema: true,
            systemPrompt: true,
          },
        },
        transcript: {
          select: {
            id: true,
            transcriptText: true,
          },
        },
        artifacts: {
          select: {
            id: true,
            artifactsPayload: true,
          },
        },
      },
    });

    if (!meeting) {
      console.log('❌ Meeting not found');
      return;
    }

    console.log('📊 Meeting Information:');
    console.log(`   Status: ${meeting.status}`);
    console.log(`   Created At: ${meeting.createdAt.toISOString()}`);
    console.log(`   Has Transcript: ${meeting.transcript ? '✅ Yes' : '❌ No'}`);
    console.log(`   Has Artifacts: ${meeting.artifacts ? '✅ Yes' : '❌ No'}`);
    console.log(`   Scenario: ${meeting.scenario?.name || 'N/A'}`);
    console.log();

    if (!meeting.scenario) {
      console.log('❌ Scenario not found for this meeting');
      return;
    }

    // Get all LLM interactions
    const interactions = await prisma.lLMInteraction.findMany({
      where: { meetingId },
      orderBy: [
        { attemptNumber: 'asc' },
        { isRepairAttempt: 'asc' },
        { requestedAt: 'asc' },
      ],
    });

    console.log(`\n📋 LLM Interactions (${interactions.length} total):\n`);

    if (interactions.length === 0) {
      console.log('❌ No LLM interactions found');
      return;
    }

    for (let i = 0; i < interactions.length; i++) {
      const interaction = interactions[i];
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📝 Interaction #${i + 1}:`);
      console.log(`   ID: ${interaction.id}`);
      console.log(`   Attempt Number: ${interaction.attemptNumber}`);
      console.log(`   Is Repair Attempt: ${interaction.isRepairAttempt ? '✅ Yes' : '❌ No'}`);
      console.log(`   Is Final: ${interaction.isFinal ? '✅ Yes' : '❌ No'}`);
      console.log(`   Is Valid: ${interaction.isValid === null ? '⏳ Not validated' : interaction.isValid ? '✅ Valid' : '❌ Invalid'}`);
      console.log(`   Model: ${interaction.model}`);
      console.log(`   Temperature: ${interaction.temperature}`);
      console.log(`   Max Tokens: ${interaction.maxTokens}`);
      console.log(`   Requested At: ${interaction.requestedAt.toISOString()}`);
      console.log(`   Responded At: ${interaction.respondedAt?.toISOString() || 'N/A'}`);
      console.log(`   Processed At: ${interaction.processedAt?.toISOString() || 'N/A'}`);
      
      if (interaction.errorCode) {
        console.log(`   ❌ Error Code: ${interaction.errorCode}`);
        console.log(`   ❌ Error Message: ${interaction.errorMessage || 'N/A'}`);
        if (interaction.errorDetails) {
          console.log(`   ❌ Error Details:`, JSON.stringify(interaction.errorDetails, null, 2));
        }
      }

      if (interaction.validationErrors) {
        console.log(`   ⚠️  Validation Errors:`, JSON.stringify(interaction.validationErrors, null, 2));
      }

      if (interaction.apiResponseMetadata) {
        const metadata = interaction.apiResponseMetadata as any;
        if (metadata.usage) {
          console.log(`   📊 Token Usage:`);
          console.log(`      Prompt: ${metadata.usage.prompt_tokens}`);
          console.log(`      Completion: ${metadata.usage.completion_tokens}`);
          console.log(`      Total: ${metadata.usage.total_tokens}`);
        }
        if (metadata.finish_reason) {
          console.log(`   📊 Finish Reason: ${metadata.finish_reason}`);
        }
      }

      // Analyze raw response
      if (interaction.rawResponse) {
        console.log(`\n   📄 Raw Response (first 500 chars):`);
        const preview = interaction.rawResponse.substring(0, 500);
        console.log(`   ${preview}${interaction.rawResponse.length > 500 ? '...' : ''}`);
        console.log(`   Total length: ${interaction.rawResponse.length} chars`);

        // Try to extract JSON
        const extracted = extractJSONFromResponse(interaction.rawResponse);
        if (extracted) {
          console.log(`   ✅ JSON extraction successful`);
          console.log(`   📋 Extracted JSON structure:`, JSON.stringify(extracted, null, 2).substring(0, 1000));
        } else {
          console.log(`   ❌ JSON extraction failed`);
        }

        // Validate against schema if we have extracted JSON
        if (extracted && meeting.scenario.outputSchema) {
          console.log(`\n   🔍 Validating against output schema...`);
          const validation = validateLLMResponse(extracted, meeting.scenario.outputSchema);
          
          if (validation.valid) {
            console.log(`   ✅ Validation PASSED`);
            if (validation.data) {
              console.log(`   📋 Validated structure:`, JSON.stringify(validation.data, null, 2).substring(0, 1000));
            }
          } else {
            console.log(`   ❌ Validation FAILED`);
            if (validation.errors) {
              console.log(`   ❌ Validation Errors:`);
              validation.errors.forEach((error, idx) => {
                console.log(`      ${idx + 1}. ${error}`);
              });
            }
          }
        }
      } else {
        console.log(`   ⚠️  No raw response available`);
      }

      if (interaction.extractedJson) {
        console.log(`\n   📋 Extracted JSON (from DB):`);
        console.log(`   ${JSON.stringify(interaction.extractedJson, null, 2).substring(0, 1000)}${JSON.stringify(interaction.extractedJson).length > 1000 ? '...' : ''}`);
      }

      console.log();
    }

    // Get processing errors
    const processingErrors = await prisma.processingError.findMany({
      where: {
        meetingId,
        stage: 'llm',
      },
      orderBy: {
        occurredAt: 'desc',
      },
    });

    if (processingErrors.length > 0) {
      console.log(`\n❌ Processing Errors (${processingErrors.length} total):\n`);
      processingErrors.forEach((error, idx) => {
        console.log(`   ${idx + 1}. [${error.occurredAt.toISOString()}]`);
        console.log(`      Code: ${error.errorCode}`);
        console.log(`      Message: ${error.errorMessage}`);
        if (error.errorDetails) {
          console.log(`      Details:`, JSON.stringify(error.errorDetails, null, 2));
        }
        console.log();
      });
    }

    // Analyze output schema
    if (meeting.scenario.outputSchema) {
      console.log(`\n📋 Output Schema Structure:`);
      console.log(JSON.stringify(meeting.scenario.outputSchema, null, 2));
      console.log();
    }

    // Summary
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📊 Summary:`);
    console.log(`   Total Interactions: ${interactions.length}`);
    console.log(`   Successful (isFinal=true): ${interactions.filter(i => i.isFinal).length}`);
    console.log(`   Valid (isValid=true): ${interactions.filter(i => i.isValid === true).length}`);
    console.log(`   Invalid (isValid=false): ${interactions.filter(i => i.isValid === false).length}`);
    console.log(`   Not Validated (isValid=null): ${interactions.filter(i => i.isValid === null).length}`);
    console.log(`   With Errors: ${interactions.filter(i => i.errorCode).length}`);
    console.log(`   Processing Errors: ${processingErrors.length}`);
    console.log();

    // Find the problematic interaction
    const failedInteractions = interactions.filter(i => 
      i.isValid === false || 
      (i.rawResponse && !i.isFinal && i.isValid !== true)
    );

    if (failedInteractions.length > 0) {
      console.log(`\n🔴 Problematic Interactions:`);
      failedInteractions.forEach((interaction, idx) => {
        console.log(`\n   ${idx + 1}. Attempt #${interaction.attemptNumber} (${interaction.isRepairAttempt ? 'Repair' : 'Initial'})`);
        if (interaction.rawResponse) {
          const extracted = extractJSONFromResponse(interaction.rawResponse);
          if (extracted && meeting.scenario.outputSchema) {
            const validation = validateLLMResponse(extracted, meeting.scenario.outputSchema);
            if (!validation.valid && validation.errors) {
              console.log(`      Validation Errors:`);
              validation.errors.forEach((error, i) => {
                console.log(`         ${i + 1}. ${error}`);
              });
            }
          }
        }
      });
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

const meetingId = process.argv[2];
if (!meetingId) {
  console.error('Usage: npx tsx scripts/analyze-llm-validation-error.ts <meetingId>');
  process.exit(1);
}

analyzeLLMValidationError(meetingId);








