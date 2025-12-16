/**
 * Sync Queue with Database
 * Очищает задачи для несуществующих встреч и перезапускает задачи для существующих
 */

import { getProcessingQueue } from '../lib/orchestrator/queue';
import { prisma } from '../lib/prisma';
import { enqueueProcessingJob } from '../lib/orchestrator/queue';

async function syncQueueWithDb() {
  const queue = getProcessingQueue();

  console.log('\n=== СИНХРОНИЗАЦИЯ ОЧЕРЕДИ С БД ===\n');

  try {
    // Получаем все проваленные задачи
    const failedJobs = await queue.getFailed(0, 1000);
    console.log(`Найдено проваленных задач: ${failedJobs.length}`);

    if (failedJobs.length === 0) {
      console.log('Нет проваленных задач для синхронизации.');
      await queue.close();
      await prisma.$disconnect();
      return;
    }

    // Собираем все meetingId
    const meetingIds = failedJobs
      .map((job) => (job.data as any)?.meetingId)
      .filter(Boolean) as string[];

    // Проверяем существование встреч
    const existingMeetings = await prisma.meeting.findMany({
      where: {
        id: {
          in: meetingIds,
        },
      },
      select: {
        id: true,
        status: true,
      },
    });

    const existingIds = new Set(existingMeetings.map((m) => m.id));
    const missingIds = meetingIds.filter((id) => !existingIds.has(id));

    console.log(`\nВстречи существуют: ${existingIds.size}`);
    console.log(`Встречи НЕ существуют: ${missingIds.length}`);

    // Удаляем задачи для несуществующих встреч
    if (missingIds.length > 0) {
      console.log('\n🗑️  Удаление задач для несуществующих встреч...');
      let deletedCount = 0;

      for (const meetingId of missingIds) {
        const job = failedJobs.find(
          (j) => (j.data as any)?.meetingId === meetingId
        );
        if (job) {
          try {
            await job.remove();
            deletedCount++;
            console.log(`  ✅ Удалена задача для ${meetingId} (Job: ${job.id})`);
          } catch (error) {
            console.error(
              `  ❌ Ошибка при удалении задачи для ${meetingId}:`,
              error
            );
          }
        }
      }

      console.log(`\nУдалено задач: ${deletedCount}`);
    }

    // Перезапускаем задачи для существующих встреч, которые в статусе Uploaded
    if (existingIds.size > 0) {
      console.log('\n🔄 Проверка задач для существующих встреч...');
      let restartedCount = 0;
      let skippedCount = 0;

      for (const meeting of existingMeetings) {
        const job = failedJobs.find(
          (j) => (j.data as any)?.meetingId === meeting.id
        );

        if (!job) continue;

        // Перезапускаем только если встреча в статусе, который требует обработки
        const shouldRestart =
          meeting.status === 'Uploaded' ||
          meeting.status === 'Transcribing' ||
          meeting.status === 'LLM_Processing' ||
          meeting.status === 'Failed_System' ||
          meeting.status === 'Failed_Transcription' ||
          meeting.status === 'Failed_LLM';

        if (shouldRestart) {
          try {
            // Удаляем старую проваленную задачу
            await job.remove();

            // Добавляем новую задачу
            await enqueueProcessingJob(meeting.id);
            restartedCount++;
            console.log(
              `  ✅ Перезапущена задача для ${meeting.id} (статус: ${meeting.status})`
            );
          } catch (error) {
            console.error(
              `  ❌ Ошибка при перезапуске задачи для ${meeting.id}:`,
              error
            );
          }
        } else {
          skippedCount++;
          console.log(
            `  ⏭️  Пропущена встреча ${meeting.id} (статус: ${meeting.status}, не требует обработки)`
          );
        }
      }

      console.log(`\nПерезапущено задач: ${restartedCount}`);
      console.log(`Пропущено задач: ${skippedCount}`);
    }

    // Проверяем активные и ожидающие задачи
    console.log('\n📊 Проверка активных и ожидающих задач...');
    const activeJobs = await queue.getActive();
    const waitingJobs = await queue.getWaiting();
    const delayedJobs = await queue.getDelayed(0, 100);

    const allActiveMeetingIds = new Set<string>();
    activeJobs.forEach((job) => {
      const meetingId = (job.data as any)?.meetingId;
      if (meetingId) allActiveMeetingIds.add(meetingId);
    });
    waitingJobs.forEach((job) => {
      const meetingId = (job.data as any)?.meetingId;
      if (meetingId) allActiveMeetingIds.add(meetingId);
    });
    delayedJobs.forEach((job) => {
      const meetingId = (job.data as any)?.meetingId;
      if (meetingId) allActiveMeetingIds.add(meetingId);
    });

    if (allActiveMeetingIds.size > 0) {
      const activeArray = Array.from(allActiveMeetingIds);
      const activeExisting = await prisma.meeting.findMany({
        where: {
          id: {
            in: activeArray,
          },
        },
        select: {
          id: true,
        },
      });

      const activeExistingIds = new Set(activeExisting.map((m) => m.id));
      const activeMissing = activeArray.filter(
        (id) => !activeExistingIds.has(id)
      );

      if (activeMissing.length > 0) {
        console.log(
          `\n⚠️  Найдено активных/ожидающих задач для несуществующих встреч: ${activeMissing.length}`
        );
        activeMissing.forEach((id) => {
          console.log(`  - ${id}`);
        });
        console.log(
          '\n  Примечание: Эти задачи будут автоматически провалены воркером с новой логикой.'
        );
      } else {
        console.log('✅ Все активные/ожидающие задачи для существующих встреч');
      }
    } else {
      console.log('Нет активных/ожидающих задач');
    }

    console.log('\n✅ Синхронизация завершена\n');
  } catch (error) {
    console.error('❌ Ошибка при синхронизации:', error);
    throw error;
  } finally {
    await queue.close();
    await prisma.$disconnect();
  }
}

// Запуск
syncQueueWithDb()
  .then(() => {
    console.log('✅ Скрипт завершен успешно\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Критическая ошибка:', error);
    process.exit(1);
  });



