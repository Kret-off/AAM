/**
 * Check raw LLM response from specific interaction
 * Usage: npx tsx scripts/check-llm-response.ts <interactionId>
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkLLMResponse(interactionId: string) {
  console.log(`\n🔍 Проверка LLM Interaction: ${interactionId}\n`);

  try {
    const interaction = await prisma.lLMInteraction.findUnique({
      where: { id: interactionId },
    });

    if (!interaction) {
      console.log('❌ Interaction не найдена');
      return;
    }

    console.log('📊 Информация о взаимодействии:');
    console.log(`   ID: ${interaction.id}`);
    console.log(`   Meeting ID: ${interaction.meetingId}`);
    console.log(`   Attempt Number: ${interaction.attemptNumber}`);
    console.log(`   Is Repair Attempt: ${interaction.isRepairAttempt}`);
    console.log(`   Is Valid: ${interaction.isValid}`);
    console.log(`   Is Final: ${interaction.isFinal}`);
    console.log(`   Requested At: ${interaction.requestedAt.toISOString()}`);
    console.log(`   Responded At: ${interaction.respondedAt?.toISOString() || 'N/A'}`);

    console.log('\n📝 Raw Response:');
    if (interaction.rawResponse) {
      console.log('   ✅ Есть rawResponse');
      console.log(`   Длина: ${interaction.rawResponse.length} символов`);
      console.log('\n   Первые 500 символов:');
      console.log('   ' + '-'.repeat(70));
      console.log(interaction.rawResponse.substring(0, 500));
      console.log('   ' + '-'.repeat(70));
      
      if (interaction.rawResponse.length > 500) {
        console.log('\n   Последние 500 символов:');
        console.log('   ' + '-'.repeat(70));
        console.log(interaction.rawResponse.substring(interaction.rawResponse.length - 500));
        console.log('   ' + '-'.repeat(70));
      }

      // Попытка извлечь JSON
      try {
        const jsonMatch = interaction.rawResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const jsonStr = jsonMatch[0];
          const parsed = JSON.parse(jsonStr);
          console.log('\n   ✅ JSON найден и распарсен');
          console.log(`   Ключи верхнего уровня: ${Object.keys(parsed).join(', ')}`);
          
          // Проверка структуры artifacts
          if (parsed.artifacts && typeof parsed.artifacts === 'object') {
            console.log(`   Ключи в artifacts: ${Object.keys(parsed.artifacts).join(', ')}`);
            
            // Проверка tasks_and_requirements
            if (parsed.artifacts.tasks_and_requirements && Array.isArray(parsed.artifacts.tasks_and_requirements)) {
              console.log(`   tasks_and_requirements: массив из ${parsed.artifacts.tasks_and_requirements.length} элементов`);
              parsed.artifacts.tasks_and_requirements.forEach((task: any, index: number) => {
                if (task.category) {
                  console.log(`     [${index}] category: "${task.category}"`);
                }
              });
            }
          }
        }
      } catch (e) {
        console.log('\n   ⚠️  Не удалось распарсить JSON из rawResponse');
      }
    } else {
      console.log('   ❌ rawResponse отсутствует');
    }

    console.log('\n📦 Extracted JSON:');
    if (interaction.extractedJson) {
      console.log('   ✅ Есть extractedJson');
      const json = interaction.extractedJson as Record<string, unknown>;
      console.log(`   Ключи: ${Object.keys(json).join(', ')}`);
      
      if (json.artifacts && typeof json.artifacts === 'object') {
        const artifacts = json.artifacts as Record<string, unknown>;
        console.log(`   Ключи в artifacts: ${Object.keys(artifacts).join(', ')}`);
      }
    } else {
      console.log('   ❌ extractedJson отсутствует');
    }

    console.log('\n❌ Validation Errors:');
    if (interaction.validationErrors) {
      console.log('   ✅ Есть ошибки валидации');
      const errors = interaction.validationErrors as unknown;
      console.log(JSON.stringify(errors, null, 2));
    } else {
      console.log('   ❌ Ошибок валидации нет');
    }

    console.log('\n🔍 Error Info:');
    console.log(`   Error Code: ${interaction.errorCode || 'Нет'}`);
    console.log(`   Error Message: ${interaction.errorMessage || 'Нет'}`);
    if (interaction.errorDetails) {
      console.log(`   Error Details: ${JSON.stringify(interaction.errorDetails, null, 2)}`);
    }

  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

const interactionId = process.argv[2];
if (!interactionId) {
  console.error('Usage: npx tsx scripts/check-llm-response.ts <interactionId>');
  process.exit(1);
}

checkLLMResponse(interactionId);







