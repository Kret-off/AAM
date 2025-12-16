/**
 * Show Worker Log Script
 * Показывает полный журнал обработки встреч воркером в табличном формате
 */

import { prisma } from '../lib/prisma';
import { getProcessingQueue } from '../lib/orchestrator/queue';

interface JobLogEntry {
  jobId: string;
  meetingId: string;
  meetingTitle: string | null;
  status: string;
  state: 'completed' | 'failed' | 'active' | 'waiting';
  createdAt: Date | null;
  processedAt: Date | null;
  finishedAt: Date | null;
  duration: number | null; // seconds
  attempts: number;
  errorMessage: string | null;
  errorCode: string | null;
  hasTranscript: boolean;
  hasArtifacts: boolean;
  processingErrors: number;
  llmInteractions: number;
}

async function showWorkerLog() {
  const queue = getProcessingQueue();
  
  try {
    console.log('\n📊 Сбор данных журнала воркера...\n');

    // Получаем все джобы из очереди
    const completedJobs = await queue.getCompleted(0, 1000);
    const failedJobs = await queue.getFailed(0, 1000);
    const activeJobs = await queue.getActive();
    const waitingJobs = await queue.getWaiting();

    // Собираем все meetingId из джобов
    const allMeetingIds = new Set<string>();
    
    completedJobs.forEach(job => {
      const jobData = job.data as { meetingId?: string } | undefined;
      const meetingId = jobData?.meetingId;
      if (meetingId) allMeetingIds.add(meetingId);
    });
    
    failedJobs.forEach(job => {
      const jobData = job.data as { meetingId?: string } | undefined;
      const meetingId = jobData?.meetingId;
      if (meetingId) allMeetingIds.add(meetingId);
    });
    
    activeJobs.forEach(job => {
      const jobData = job.data as { meetingId?: string } | undefined;
      const meetingId = jobData?.meetingId;
      if (meetingId) allMeetingIds.add(meetingId);
    });
    
    waitingJobs.forEach(job => {
      const jobData = job.data as { meetingId?: string } | undefined;
      const meetingId = jobData?.meetingId;
      if (meetingId) allMeetingIds.add(meetingId);
    });

    // Получаем информацию о встречах из БД
    const meetings = await prisma.meeting.findMany({
      where: {
        id: {
          in: Array.from(allMeetingIds),
        },
      },
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        transcript: {
          select: { id: true },
        },
        artifacts: {
          select: { id: true },
        },
        processingErrors: {
          select: {
            id: true,
            stage: true,
            errorCode: true,
            errorMessage: true,
            occurredAt: true,
          },
          orderBy: {
            occurredAt: 'desc',
          },
        },
        llmInteractions: {
          select: {
            id: true,
            attemptNumber: true,
            isValid: true,
            isFinal: true,
            requestedAt: true,
            errorMessage: true,
          },
          orderBy: {
            requestedAt: 'desc',
          },
        },
      },
    });

    // Создаем мапу для быстрого доступа
    const meetingsMap = new Map(meetings.map(m => [m.id, m]));

    // Формируем записи журнала
    const logEntries: JobLogEntry[] = [];

    // Обработанные джобы
    completedJobs.forEach(job => {
      const jobData = job.data as { meetingId?: string } | undefined;
      const meetingId = jobData?.meetingId;
      if (!meetingId) return;

      const meeting = meetingsMap.get(meetingId);
      const duration = job.processedOn && job.finishedOn
        ? Math.round((job.finishedOn - job.processedOn) / 1000)
        : null;

      logEntries.push({
        jobId: job.id || 'N/A',
        meetingId,
        meetingTitle: meeting?.title || null,
        status: meeting?.status || 'Unknown',
        state: 'completed',
        createdAt: job.timestamp ? new Date(job.timestamp) : null,
        processedAt: job.processedOn ? new Date(job.processedOn) : null,
        finishedAt: job.finishedOn ? new Date(job.finishedOn) : null,
        duration,
        attempts: job.attemptsMade || 0,
        errorMessage: null,
        errorCode: null,
        hasTranscript: !!meeting?.transcript,
        hasArtifacts: !!meeting?.artifacts,
        processingErrors: meeting?.processingErrors.length || 0,
        llmInteractions: meeting?.llmInteractions.length || 0,
      });
    });

    // Провалившиеся джобы
    failedJobs.forEach(job => {
      const jobData = job.data as { meetingId?: string } | undefined;
      const meetingId = jobData?.meetingId;
      if (!meetingId) return;

      const meeting = meetingsMap.get(meetingId);
      const duration = job.processedOn && job.finishedOn
        ? Math.round((job.finishedOn - job.processedOn) / 1000)
        : null;

      logEntries.push({
        jobId: job.id || 'N/A',
        meetingId,
        meetingTitle: meeting?.title || null,
        status: meeting?.status || 'Unknown',
        state: 'failed',
        createdAt: job.timestamp ? new Date(job.timestamp) : null,
        processedAt: job.processedOn ? new Date(job.processedOn) : null,
        finishedAt: job.finishedOn ? new Date(job.finishedOn) : null,
        duration,
        attempts: job.attemptsMade || 0,
        errorMessage: job.failedReason || null,
        errorCode: meeting?.processingErrors[0]?.errorCode || null,
        hasTranscript: !!meeting?.transcript,
        hasArtifacts: !!meeting?.artifacts,
        processingErrors: meeting?.processingErrors.length || 0,
        llmInteractions: meeting?.llmInteractions.length || 0,
      });
    });

    // Активные джобы
    activeJobs.forEach(job => {
      const jobData = job.data as { meetingId?: string } | undefined;
      const meetingId = jobData?.meetingId;
      if (!meetingId) return;

      const meeting = meetingsMap.get(meetingId);

      logEntries.push({
        jobId: job.id || 'N/A',
        meetingId,
        meetingTitle: meeting?.title || null,
        status: meeting?.status || 'Unknown',
        state: 'active',
        createdAt: job.timestamp ? new Date(job.timestamp) : null,
        processedAt: job.processedOn ? new Date(job.processedOn) : null,
        finishedAt: null,
        duration: null,
        attempts: job.attemptsMade || 0,
        errorMessage: null,
        errorCode: null,
        hasTranscript: !!meeting?.transcript,
        hasArtifacts: !!meeting?.artifacts,
        processingErrors: meeting?.processingErrors.length || 0,
        llmInteractions: meeting?.llmInteractions.length || 0,
      });
    });

    // Ожидающие джобы
    waitingJobs.forEach(job => {
      const jobData = job.data as { meetingId?: string } | undefined;
      const meetingId = jobData?.meetingId;
      if (!meetingId) return;

      const meeting = meetingsMap.get(meetingId);

      logEntries.push({
        jobId: job.id || 'N/A',
        meetingId,
        meetingTitle: meeting?.title || null,
        status: meeting?.status || 'Unknown',
        state: 'waiting',
        createdAt: job.timestamp ? new Date(job.timestamp) : null,
        processedAt: null,
        finishedAt: null,
        duration: null,
        attempts: 0,
        errorMessage: null,
        errorCode: null,
        hasTranscript: !!meeting?.transcript,
        hasArtifacts: !!meeting?.artifacts,
        processingErrors: meeting?.processingErrors.length || 0,
        llmInteractions: meeting?.llmInteractions.length || 0,
      });
    });

    // Сортируем по времени создания (новые сначала)
    logEntries.sort((a, b) => {
      const timeA = a.createdAt?.getTime() || 0;
      const timeB = b.createdAt?.getTime() || 0;
      return timeB - timeA;
    });

    // Выводим таблицу
    console.log('='.repeat(150));
    console.log('📋 ЖУРНАЛ ОБРАБОТКИ ВСТРЕЧ ВОРКЕРОМ');
    console.log('='.repeat(150));
    console.log(`Всего записей: ${logEntries.length}`);
    console.log(`  ✅ Завершено: ${completedJobs.length}`);
    console.log(`  ❌ Провалено: ${failedJobs.length}`);
    console.log(`  🔄 Активных: ${activeJobs.length}`);
    console.log(`  ⏳ Ожидает: ${waitingJobs.length}`);
    console.log('='.repeat(150));
    console.log('');

    if (logEntries.length === 0) {
      console.log('Нет записей в журнале.');
      return;
    }

    // Заголовок таблицы
    const header = [
      '№',
      'Состояние',
      'Meeting ID',
      'Название',
      'Статус',
      'Создан',
      'Обработан',
      'Завершен',
      'Длительность',
      'Попытки',
      'Транскрипт',
      'Артефакты',
      'Ошибки',
      'LLM',
      'Ошибка',
    ];

    const colWidths = [
      4,   // №
      12,  // Состояние
      12,  // Meeting ID
      20,  // Название
      18,  // Статус
      20,  // Создан
      20,  // Обработан
      20,  // Завершен
      12,  // Длительность
      8,   // Попытки
      12,  // Транскрипт
      10,  // Артефакты
      8,   // Ошибки
      6,   // LLM
      30,  // Ошибка
    ];

    // Функция для форматирования ячейки
    function formatCell(value: string | null | undefined, width: number): string {
      if (value === null || value === undefined) return ' '.repeat(width);
      const str = String(value);
      if (str.length > width) {
        return str.substring(0, width - 3) + '...';
      }
      return str.padEnd(width);
    }

    // Функция для форматирования даты
    function formatDate(date: Date | null): string {
      if (!date) return 'N/A';
      return date.toISOString().replace('T', ' ').substring(0, 19);
    }

    // Функция для форматирования длительности
    function formatDuration(seconds: number | null): string {
      if (seconds === null) return 'N/A';
      if (seconds < 60) return `${seconds}s`;
      const minutes = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${minutes}m ${secs}s`;
    }

    // Выводим заголовок
    console.log(header.map((h, i) => formatCell(h, colWidths[i])).join(' | '));
    console.log('-'.repeat(150));

    // Выводим строки
    logEntries.forEach((entry, index) => {
      const stateEmoji = {
        completed: '✅',
        failed: '❌',
        active: '🔄',
        waiting: '⏳',
      }[entry.state] || '❓';

      const stateText = {
        completed: 'Завершено',
        failed: 'Провалено',
        active: 'Активно',
        waiting: 'Ожидает',
      }[entry.state] || 'Неизвестно';

      const row = [
        String(index + 1),
        `${stateEmoji} ${stateText}`,
        entry.meetingId.substring(0, 12) + '...',
        entry.meetingTitle || 'N/A',
        entry.status,
        formatDate(entry.createdAt),
        formatDate(entry.processedAt),
        formatDate(entry.finishedAt),
        formatDuration(entry.duration),
        String(entry.attempts),
        entry.hasTranscript ? '✅' : '❌',
        entry.hasArtifacts ? '✅' : '❌',
        String(entry.processingErrors),
        String(entry.llmInteractions),
        entry.errorMessage ? (entry.errorMessage.substring(0, 27) + '...') : '',
      ];

      console.log(row.map((cell, i) => formatCell(cell, colWidths[i])).join(' | '));
    });

    console.log('='.repeat(150));
    console.log('');

    // Дополнительная статистика
    const statusCounts = new Map<string, number>();
    logEntries.forEach(entry => {
      statusCounts.set(entry.status, (statusCounts.get(entry.status) || 0) + 1);
    });

    console.log('📊 Статистика по статусам:');
    Array.from(statusCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([status, count]) => {
        console.log(`  ${status}: ${count}`);
      });

    console.log('');

  } catch (error) {
    console.error('❌ Ошибка при получении журнала:', error);
    throw error;
  } finally {
    await queue.close();
    await prisma.$disconnect();
  }
}

// Запуск
showWorkerLog()
  .then(() => {
    console.log('\n✅ Журнал успешно выведен\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Критическая ошибка:', error);
    process.exit(1);
  });

