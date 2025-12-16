/**
 * Script to check meeting pipeline status - specifically for LLM processing
 * Usage: npx tsx scripts/check-meeting-pipeline.ts <meetingId>
 */

import { PrismaClient } from '@prisma/client';
import { getProcessingQueue } from '@/lib/orchestrator/queue';

const prisma = new PrismaClient();

async function checkMeetingPipeline(meetingId: string) {
  console.log(`\n🔍 Проверка статуса встречи: ${meetingId}\n`);

  try {
    // Get meeting with all relations
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      select: {
        id: true,
        status: true,
        createdAt: true,
        title: true,
        transcript: {
          select: {
            id: true,
            createdAt: true,
            transcriptText: true,
          },
        },
        artifacts: {
          select: {
            id: true,
            createdAt: true,
          },
        },
        processingErrors: {
          where: {
            stage: 'llm',
          },
          orderBy: {
            occurredAt: 'desc',
          },
          take: 1,
        },
      },
    });

    if (!meeting) {
      console.log('❌ Встреча не найдена');
      return;
    }

    console.log('📊 Статус встречи:');
    console.log(`   ID: ${meeting.id}`);
    console.log(`   Статус: ${meeting.status}`);
    console.log(`   Создана: ${meeting.createdAt.toISOString()}`);

    // Check transcript
    console.log('\n📝 Транскрипция:');
    if (meeting.transcript) {
      console.log(`   ✅ Транскрипция завершена`);
      console.log(`   Создана: ${meeting.transcript.createdAt.toISOString()}`);
      const textLength = typeof meeting.transcript.transcriptText === 'string' 
        ? meeting.transcript.transcriptText.length 
        : 0;
      console.log(`   Длина текста: ${textLength} символов`);
    } else {
      console.log('   ❌ Транскрипция отсутствует');
      console.log('   ⚠️  Текст транскрипции ещё не готов');
      return;
    }

    // Check artifacts (LLM processing result)
    console.log('\n🤖 Обработка LLM:');
    if (meeting.artifacts) {
      console.log(`   ✅ LLM обработка завершена`);
      console.log(`   Создана: ${meeting.artifacts.createdAt.toISOString()}`);
      console.log(`   ✅ Текст транскрипции УЖЕ отправлен в LLM и обработан`);
    } else {
      console.log('   ❌ Артефакты отсутствуют');
      console.log('   ⚠️  Текст транскрипции ЕЩЁ НЕ отправлен в LLM');
    }

    // Check processing errors
    if (meeting.processingErrors.length > 0) {
      console.log('\n⚠️  Ошибки обработки LLM:');
      const error = meeting.processingErrors[0];
      console.log(`   Код ошибки: ${error.errorCode}`);
      console.log(`   Сообщение: ${error.errorMessage}`);
      console.log(`   Время: ${error.occurredAt.toISOString()}`);
    }

    // Check BullMQ queue for active jobs
    console.log('\n🔄 Статус очереди обработки:');
    try {
      const queue = getProcessingQueue();
      const jobId = `process-meeting-${meetingId}`;
      const job = await queue.getJob(jobId);
      
      if (job) {
        const state = await job.getState();
        console.log(`   Job ID: ${job.id}`);
        console.log(`   Состояние: ${state}`);
        console.log(`   Попыток: ${job.attemptsMade}`);
        
        if (state === 'active') {
          console.log('   ✅ Процесс АКТИВЕН - обработка идёт прямо сейчас');
        } else if (state === 'waiting') {
          console.log('   ⏳ Процесс в ОЖИДАНИИ - ждёт своей очереди');
        } else if (state === 'delayed') {
          console.log('   ⏸️  Процесс ОТЛОЖЕН - запланирован на позже');
        } else if (state === 'completed') {
          console.log('   ✅ Процесс ЗАВЕРШЁН');
        } else if (state === 'failed') {
          console.log('   ❌ Процесс ПРОВАЛЕН');
          if (job.failedReason) {
            console.log(`   Причина: ${job.failedReason}`);
          }
        }
        
        if (job.processedOn) {
          console.log(`   Начало обработки: ${new Date(job.processedOn).toISOString()}`);
        }
        if (job.finishedOn) {
          console.log(`   Завершено: ${new Date(job.finishedOn).toISOString()}`);
        }
      } else {
        console.log(`   ⚠️  Job не найден с ID: ${jobId}`);
        
        // Check if there are any active/waiting jobs for this meeting
        const waitingJobs = await queue.getWaiting();
        const activeJobs = await queue.getActive();
        const delayedJobs = await queue.getDelayed();
        
        const relatedWaiting = waitingJobs.find(j => j.data.meetingId === meetingId);
        const relatedActive = activeJobs.find(j => j.data.meetingId === meetingId);
        const relatedDelayed = delayedJobs.find(j => j.data.meetingId === meetingId);
        
        if (relatedWaiting) {
          console.log(`   ⏳ Найдена задача в очереди ожидания: ${relatedWaiting.id}`);
        }
        if (relatedActive) {
          console.log(`   ✅ Найдена активная задача: ${relatedActive.id}`);
        }
        if (relatedDelayed) {
          console.log(`   ⏸️  Найдена отложенная задача: ${relatedDelayed.id}`);
        }
        
        if (!relatedWaiting && !relatedActive && !relatedDelayed) {
          console.log('   ℹ️  Нет активных задач в очереди');
          console.log('   Это может означать, что:');
          console.log('      - Задача уже выполнена и удалена');
          console.log('      - Задача ещё не была поставлена в очередь');
          console.log('      - Задача провалилась и была удалена');
        }
      }
    } catch (error: any) {
      console.log(`   ⚠️  Ошибка при проверке очереди: ${error.message}`);
    }

    // Check for active jobs one more time for final analysis
    let hasActiveJob = false;
    try {
      const queue = getProcessingQueue();
      const activeJobs = await queue.getActive();
      hasActiveJob = activeJobs.some(j => j.data.meetingId === meetingId);
    } catch (error) {
      // Ignore
    }

    // Final analysis
    console.log('\n📋 Итоговый анализ:');
    if (!meeting.transcript) {
      console.log('   ⚠️  Транскрипция ещё не готова - процесс на этапе транскрибации');
      console.log('   ❌ Текст транскрипции ЕЩЁ НЕ отправлен в LLM');
    } else if (!meeting.artifacts) {
      if (meeting.status === 'LLM_Processing') {
        if (hasActiveJob) {
          console.log('   ⏳ Транскрипция готова, LLM обработка В ПРОЦЕССЕ ПРЯМО СЕЙЧАС');
          console.log('   ✅ Текст транскрипции УЖЕ отправлен в LLM, идёт обработка');
        } else {
          console.log('   ⚠️  Статус "LLM_Processing", но активных задач нет');
          console.log('   💡 Возможные причины:');
          console.log('      - LLM обработка завершилась с ошибкой (проверьте ошибки выше)');
          console.log('      - Процесс завис или был прерван');
          console.log('      - Worker не запущен или остановился');
          console.log('   ✅ Текст транскрипции БЫЛ отправлен в LLM, но результат не сохранён');
        }
      } else if (meeting.status === 'Transcribing') {
        console.log('   ⚠️  Статус "Transcribing", но транскрипция уже есть');
        console.log('   💡 Возможно, процесс перехода к LLM обработке на паузе');
        console.log('   ❌ Текст транскрипции ЕЩЁ НЕ отправлен в LLM');
      } else {
        console.log('   ⚠️  Транскрипция готова, но LLM обработка НЕ НАЧАТА');
        console.log('   💡 Процесс на паузе - текст транскрипции ЕЩЁ НЕ отправлен в LLM');
      }
    } else {
      console.log('   ✅ Полный цикл обработки завершён');
      console.log('   ✅ Текст транскрипции был отправлен в LLM и обработан');
    }

  } catch (error: any) {
    console.error('❌ Ошибка:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

const meetingId = process.argv[2];
if (!meetingId) {
  console.error('Usage: npx tsx scripts/check-meeting-pipeline.ts <meetingId>');
  process.exit(1);
}

checkMeetingPipeline(meetingId);

