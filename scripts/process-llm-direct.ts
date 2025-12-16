/**
 * Script to directly process LLM for a meeting
 * Usage: npx tsx scripts/process-llm-direct.ts <meetingId>
 */

import { processLLM } from '@/lib/orchestrator/processors/llm';
import { updateMeetingStatus } from '@/lib/meeting/service';
import { prisma } from '@/lib/prisma';

async function processLLMDirect(meetingId: string) {
  console.log(`\n🤖 Прямая обработка LLM для встречи: ${meetingId}\n`);

  try {
    // Check meeting status
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      select: {
        id: true,
        status: true,
        transcript: { select: { id: true } },
        artifacts: { select: { id: true } },
      },
    });

    if (!meeting) {
      console.log('❌ Встреча не найдена');
      return;
    }

    console.log('📊 Текущий статус:');
    console.log(`   Статус: ${meeting.status}`);
    console.log(`   Транскрипция: ${meeting.transcript ? '✅ Есть' : '❌ Нет'}`);
    console.log(`   Артефакты: ${meeting.artifacts ? '✅ Есть' : '❌ Нет'}`);

    if (!meeting.transcript) {
      console.log('\n❌ Транскрипция отсутствует. Сначала нужно завершить транскрибацию.');
      return;
    }

    if (meeting.artifacts) {
      console.log('\n⚠️  Артефакты уже существуют. Обработка LLM не требуется.');
      return;
    }

    // Update status to LLM_Processing if needed
    if (meeting.status !== 'LLM_Processing') {
      console.log(`\n🔄 Обновление статуса на LLM_Processing...`);
      const statusUpdate = await updateMeetingStatus(meetingId, 'LLM_Processing');
      if ('error' in statusUpdate) {
        console.log(`❌ Ошибка обновления статуса: ${statusUpdate.error.message}`);
        return;
      }
      console.log(`✅ Статус обновлён`);
    }

    // Process LLM
    console.log(`\n🤖 Запуск обработки LLM...`);
    const result = await processLLM(meetingId);

    if (result.success) {
      console.log(`\n✅ Обработка LLM завершена успешно!`);
      
      // Check if artifacts were created
      const updatedMeeting = await prisma.meeting.findUnique({
        where: { id: meetingId },
        select: {
          artifacts: { select: { id: true, createdAt: true } },
          status: true,
        },
      });
      
      if (updatedMeeting?.artifacts) {
        console.log(`✅ Артефакты созданы: ${updatedMeeting.artifacts.id}`);
        console.log(`   Созданы: ${updatedMeeting.artifacts.createdAt.toISOString()}`);
        console.log(`   Статус встречи: ${updatedMeeting.status}`);
      } else {
        console.log(`⚠️  Артефакты не были созданы, но процесс завершился успешно`);
      }
    } else {
      console.log(`\n❌ Ошибка обработки LLM:`);
      console.log(`   Код: ${result.error?.code}`);
      console.log(`   Сообщение: ${result.error?.message}`);
      if (result.error?.details) {
        console.log(`   Детали: ${JSON.stringify(result.error.details, null, 2)}`);
      }
    }

  } catch (error: any) {
    console.error('\n❌ Ошибка:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

const meetingId = process.argv[2];
if (!meetingId) {
  console.error('Usage: npx tsx scripts/process-llm-direct.ts <meetingId>');
  process.exit(1);
}

processLLMDirect(meetingId);








