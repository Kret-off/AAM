/**
 * Detailed diagnostic script for meeting LLM processing issues
 * Usage: npx tsx scripts/diagnose-meeting-llm.ts <meetingId>
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function diagnoseMeeting(meetingId: string) {
  console.log(`\n🔍 ДИАГНОСТИКА ВСТРЕЧИ: ${meetingId}\n`);
  console.log('='.repeat(80));

  try {
    // 1. Основная информация о встрече
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        client: { select: { name: true } },
        owner: { select: { name: true, email: true } },
        meetingType: { select: { name: true } },
        scenario: { select: { name: true } },
        uploadBlob: true,
        transcript: true,
        artifacts: true,
        validation: true,
        processingErrors: {
          orderBy: { occurredAt: 'desc' },
          take: 20,
        },
        llmInteractions: {
          orderBy: [
            { attemptNumber: 'asc' },
            { isRepairAttempt: 'asc' },
            { requestedAt: 'asc' },
          ],
        },
      },
    });

    if (!meeting) {
      console.log('❌ Встреча не найдена');
      return;
    }

    console.log('\n📊 ОСНОВНАЯ ИНФОРМАЦИЯ:');
    console.log(`   ID: ${meeting.id}`);
    console.log(`   Статус: ${meeting.status}`);
    console.log(`   Клиент: ${meeting.client.name}`);
    console.log(`   Владелец: ${meeting.owner.name} (${meeting.owner.email})`);
    console.log(`   Тип встречи: ${meeting.meetingType.name}`);
    console.log(`   Сценарий: ${meeting.scenario.name}`);
    console.log(`   Создана: ${meeting.createdAt.toISOString()}`);
    console.log(`   Auto Retry Count: ${meeting.autoRetryCount}`);
    if (meeting.lastAutoRetryAt) {
      console.log(`   Last Auto Retry: ${meeting.lastAutoRetryAt.toISOString()}`);
    }
    if (meeting.nextAutoRetryAt) {
      console.log(`   Next Auto Retry: ${meeting.nextAutoRetryAt.toISOString()}`);
    }

    // 2. Проверка UploadBlob
    console.log('\n📁 UPLOAD BLOB:');
    if (meeting.uploadBlob) {
      console.log(`   ✅ СУЩЕСТВУЕТ`);
      console.log(`   Filename: ${meeting.uploadBlob.originalFilename}`);
      console.log(`   Size: ${(Number(meeting.uploadBlob.sizeBytes) / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   Expires At: ${meeting.uploadBlob.expiresAt?.toISOString() || 'Не установлено'}`);
      console.log(`   Deleted At: ${meeting.uploadBlob.deletedAt?.toISOString() || 'Не удален'}`);
    } else {
      console.log('   ❌ НЕ НАЙДЕН');
    }

    // 3. Проверка Transcript
    console.log('\n📝 TRANSCRIPT:');
    if (meeting.transcript) {
      console.log(`   ✅ СУЩЕСТВУЕТ`);
      console.log(`   ID: ${meeting.transcript.id}`);
      console.log(`   Language: ${meeting.transcript.language}`);
      console.log(`   Created: ${meeting.transcript.createdAt.toISOString()}`);
      const textLength = typeof meeting.transcript.transcriptText === 'string'
        ? meeting.transcript.transcriptText.length
        : 0;
      console.log(`   Text Length: ${textLength} chars`);
    } else {
      console.log('   ❌ НЕ НАЙДЕН');
    }

    // 4. Проверка Artifacts
    console.log('\n🤖 ARTIFACTS:');
    if (meeting.artifacts) {
      console.log(`   ✅ СУЩЕСТВУЕТ`);
      console.log(`   ID: ${meeting.artifacts.id}`);
      console.log(`   Created: ${meeting.artifacts.createdAt.toISOString()}`);
      const payload = meeting.artifacts.artifactsPayload as Record<string, unknown>;
      if (payload && typeof payload === 'object') {
        console.log(`   Payload Keys: ${Object.keys(payload).join(', ')}`);
      }
    } else {
      console.log('   ❌ НЕ НАЙДЕН');
    }

    // 5. Проверка Validation
    console.log('\n✅ VALIDATION:');
    if (meeting.validation) {
      console.log(`   ✅ СУЩЕСТВУЕТ`);
      console.log(`   Decision: ${meeting.validation.decision}`);
      console.log(`   Validated At: ${meeting.validation.validatedAt?.toISOString() || 'N/A'}`);
    } else {
      console.log('   ❌ НЕ НАЙДЕН');
    }

    // 6. LLM Interactions - КРИТИЧЕСКИ ВАЖНО
    console.log('\n🧠 LLM INTERACTIONS:');
    console.log(`   Всего записей: ${meeting.llmInteractions.length}`);
    
    if (meeting.llmInteractions.length === 0) {
      console.log('   ⚠️  НЕТ ЗАПИСЕЙ LLM INTERACTION');
    } else {
      meeting.llmInteractions.forEach((interaction, index) => {
        console.log(`\n   [${index + 1}] Interaction ID: ${interaction.id}`);
        console.log(`       Attempt Number: ${interaction.attemptNumber}`);
        console.log(`       Is Repair Attempt: ${interaction.isRepairAttempt}`);
        console.log(`       Is Valid: ${interaction.isValid}`);
        console.log(`       Is Final: ${interaction.isFinal}`);
        console.log(`       Requested At: ${interaction.requestedAt.toISOString()}`);
        console.log(`       Responded At: ${interaction.respondedAt?.toISOString() || 'N/A'}`);
        console.log(`       Processed At: ${interaction.processedAt?.toISOString() || 'N/A'}`);
        console.log(`       Error Code: ${interaction.errorCode || 'Нет'}`);
        console.log(`       Error Message: ${interaction.errorMessage || 'Нет'}`);
        
        if (interaction.extractedJson) {
          const json = interaction.extractedJson as Record<string, unknown>;
          console.log(`       Extracted JSON Keys: ${Object.keys(json).join(', ')}`);
        }
        
        if (interaction.validationErrors) {
          const errors = interaction.validationErrors as unknown;
          console.log(`       Validation Errors: ${JSON.stringify(errors, null, 2)}`);
        }
      });

      // Проверка конкретной записи
      const specificInteraction = meeting.llmInteractions.find(
        (i) => i.id === '07e6262d-4438-4225-9fae-29800a2961ea'
      );
      if (specificInteraction) {
        console.log('\n   🎯 НАЙДЕНА КОНКРЕТНАЯ ЗАПИСЬ 07e6262d-4438-4225-9fae-29800a2961ea:');
        console.log(`       Is Final: ${specificInteraction.isFinal}`);
        console.log(`       Is Valid: ${specificInteraction.isValid}`);
        console.log(`       Has Extracted JSON: ${!!specificInteraction.extractedJson}`);
        if (specificInteraction.extractedJson) {
          const json = specificInteraction.extractedJson as Record<string, unknown>;
          console.log(`       JSON Structure: ${JSON.stringify(Object.keys(json), null, 2)}`);
        }
      }

      // Поиск финальных успешных взаимодействий
      const finalInteractions = meeting.llmInteractions.filter(
        (i) => i.isFinal === true && i.isValid === true
      );
      console.log(`\n   ✅ Финальных успешных взаимодействий: ${finalInteractions.length}`);
      if (finalInteractions.length > 0) {
        finalInteractions.forEach((fi) => {
          console.log(`       - ID: ${fi.id}, Attempt: ${fi.attemptNumber}, Repair: ${fi.isRepairAttempt}`);
        });
      }
    }

    // 7. Processing Errors
    console.log('\n❌ PROCESSING ERRORS:');
    if (meeting.processingErrors.length === 0) {
      console.log('   ✅ Ошибок не зарегистрировано');
    } else {
      console.log(`   Всего ошибок: ${meeting.processingErrors.length}`);
      meeting.processingErrors.forEach((error, index) => {
        console.log(`\n   [${index + 1}] Error ID: ${error.id}`);
        console.log(`       Stage: ${error.stage}`);
        console.log(`       Error Code: ${error.errorCode}`);
        console.log(`       Error Message: ${error.errorMessage}`);
        console.log(`       Occurred At: ${error.occurredAt.toISOString()}`);
        if (error.errorDetails) {
          console.log(`       Details: ${JSON.stringify(error.errorDetails, null, 2)}`);
        }
      });
    }

    // 8. АНАЛИЗ НЕСОГЛАСОВАННОСТИ
    console.log('\n🔍 АНАЛИЗ НЕСОГЛАСОВАННОСТИ:');
    console.log('='.repeat(80));

    const hasArtifacts = !!meeting.artifacts;
    const hasFinalValidInteraction = meeting.llmInteractions.some(
      (i) => i.isFinal === true && i.isValid === true
    );
    const isFailedLLM = meeting.status === 'Failed_LLM';
    const isReady = meeting.status === 'Ready';

    console.log(`\n   Статус встречи: ${meeting.status}`);
    console.log(`   Есть артефакты: ${hasArtifacts ? '✅' : '❌'}`);
    console.log(`   Есть финальное валидное взаимодействие: ${hasFinalValidInteraction ? '✅' : '❌'}`);

    // Сценарий 1: Есть финальное валидное взаимодействие, но нет артефактов
    if (hasFinalValidInteraction && !hasArtifacts) {
      console.log('\n   ⚠️  ПРОБЛЕМА ОБНАРУЖЕНА:');
      console.log('       Есть успешное LLM взаимодействие, но артефакты не сохранены!');
      console.log('       Это указывает на ошибку при сохранении артефактов после успешной валидации.');
      
      const finalInteraction = meeting.llmInteractions.find(
        (i) => i.isFinal === true && i.isValid === true
      );
      if (finalInteraction && finalInteraction.extractedJson) {
        console.log('\n   💡 РЕШЕНИЕ:');
        console.log('       Можно восстановить артефакты из extractedJson финального взаимодействия.');
        console.log(`       Interaction ID: ${finalInteraction.id}`);
        console.log(`       Attempt Number: ${finalInteraction.attemptNumber}`);
      }
    }

    // Сценарий 2: Статус Failed_LLM, но есть финальное валидное взаимодействие
    if (isFailedLLM && hasFinalValidInteraction) {
      console.log('\n   ⚠️  ПРОБЛЕМА ОБНАРУЖЕНА:');
      console.log('       Статус Failed_LLM, но есть успешное финальное взаимодействие!');
      console.log('       Это указывает на ошибку после успешной валидации LLM.');
    }

    // Сценарий 3: Статус Failed_LLM, есть артефакты
    if (isFailedLLM && hasArtifacts) {
      console.log('\n   ⚠️  ПРОБЛЕМА ОБНАРУЖЕНА:');
      console.log('       Статус Failed_LLM, но артефакты существуют!');
      console.log('       Это указывает на несогласованность статуса.');
    }

    // Сценарий 4: Статус Ready, но нет артефактов
    if (isReady && !hasArtifacts) {
      console.log('\n   ⚠️  ПРОБЛЕМА ОБНАРУЖЕНА:');
      console.log('       Статус Ready, но артефакты отсутствуют!');
    }

    // Сценарий 5: Есть артефакты, но нет финального валидного взаимодействия
    if (hasArtifacts && !hasFinalValidInteraction) {
      console.log('\n   ⚠️  ПРОБЛЕМА ОБНАРУЖЕНА:');
      console.log('       Есть артефакты, но нет финального валидного взаимодействия!');
      console.log('       Это может указывать на проблему с сохранением LLMInteraction.');
    }

    // Проверка последней ошибки
    if (meeting.processingErrors.length > 0) {
      const lastError = meeting.processingErrors[0];
      if (lastError.stage === 'llm') {
        console.log('\n   📋 ПОСЛЕДНЯЯ ОШИБКА LLM:');
        console.log(`       Code: ${lastError.errorCode}`);
        console.log(`       Message: ${lastError.errorMessage}`);
        if (lastError.errorDetails) {
          console.log(`       Details: ${JSON.stringify(lastError.errorDetails, null, 2)}`);
        }
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ ДИАГНОСТИКА ЗАВЕРШЕНА\n');

  } catch (error) {
    console.error('❌ Ошибка при диагностике:', error);
    if (error instanceof Error) {
      console.error('   Stack:', error.stack);
    }
  } finally {
    await prisma.$disconnect();
  }
}

const meetingId = process.argv[2];
if (!meetingId) {
  console.error('Usage: npx tsx scripts/diagnose-meeting-llm.ts <meetingId>');
  process.exit(1);
}

diagnoseMeeting(meetingId);







