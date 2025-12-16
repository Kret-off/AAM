/**
 * Check scenario output schema for enum values
 * Usage: npx tsx scripts/check-scenario-schema.ts <meetingId>
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkSchema(meetingId: string) {
  console.log(`\n🔍 Проверка схемы для встречи: ${meetingId}\n`);

  try {
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      select: {
        id: true,
        scenarioId: true,
        scenario: {
          select: {
            id: true,
            name: true,
            outputSchema: true,
          },
        },
      },
    });

    if (!meeting || !meeting.scenario) {
      console.log('❌ Встреча или сценарий не найдены');
      return;
    }

    console.log('📊 Сценарий:');
    console.log(`   ID: ${meeting.scenario.id}`);
    console.log(`   Name: ${meeting.scenario.name}`);

    const schema = meeting.scenario.outputSchema as Record<string, unknown>;
    
    console.log('\n📋 Output Schema:');
    console.log(JSON.stringify(schema, null, 2));

    // Поиск enum значений в tasks_and_requirements
    function findEnumInSchema(obj: unknown, path: string = ''): void {
      if (typeof obj !== 'object' || obj === null) {
        return;
      }

      const objRecord = obj as Record<string, unknown>;

      // Проверка на enum
      if (Array.isArray(objRecord.enum)) {
        console.log(`\n   🔍 Найден enum в ${path}:`);
        console.log(`      Значения: ${objRecord.enum.join(', ')}`);
      }

      // Рекурсивный поиск
      if (objRecord.properties && typeof objRecord.properties === 'object') {
        const props = objRecord.properties as Record<string, unknown>;
        for (const [key, value] of Object.entries(props)) {
          findEnumInSchema(value, path ? `${path}.${key}` : key);
        }
      }

      if (objRecord.items && typeof objRecord.items === 'object') {
        findEnumInSchema(objRecord.items, `${path}[]`);
      }
    }

    console.log('\n🔍 Поиск enum значений в схеме:');
    findEnumInSchema(schema);

    // Специальная проверка для tasks_and_requirements/category
    console.log('\n🎯 Проверка tasks_and_requirements/category:');
    if (schema.properties && typeof schema.properties === 'object') {
      const props = schema.properties as Record<string, unknown>;
      
      if (props.artifacts && typeof props.artifacts === 'object') {
        const artifacts = props.artifacts as Record<string, unknown>;
        if (artifacts.properties && typeof artifacts.properties === 'object') {
          const artifactsProps = artifacts.properties as Record<string, unknown>;
          
          if (artifactsProps.tasks_and_requirements && typeof artifactsProps.tasks_and_requirements === 'object') {
            const tasks = artifactsProps.tasks_and_requirements as Record<string, unknown>;
            if (tasks.type === 'array' && tasks.items && typeof tasks.items === 'object') {
              const items = tasks.items as Record<string, unknown>;
              if (items.properties && typeof items.properties === 'object') {
                const itemProps = items.properties as Record<string, unknown>;
                if (itemProps.category && typeof itemProps.category === 'object') {
                  const category = itemProps.category as Record<string, unknown>;
                  if (Array.isArray(category.enum)) {
                    console.log(`   ✅ Найден enum для category:`);
                    console.log(`      Разрешенные значения: ${category.enum.join(', ')}`);
                  } else {
                    console.log('   ⚠️  Enum для category не найден или не является массивом');
                  }
                }
              }
            }
          }
        }
      }
    }

  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

const meetingId = process.argv[2];
if (!meetingId) {
  console.error('Usage: npx tsx scripts/check-scenario-schema.ts <meetingId>');
  process.exit(1);
}

checkSchema(meetingId);







