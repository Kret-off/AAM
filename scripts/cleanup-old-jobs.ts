/**
 * Script to cleanup old completed jobs from queue
 * Removes completed jobs from December 11, 2025 and earlier
 * Usage: npx tsx scripts/cleanup-old-jobs.ts
 */

import { getProcessingQueue } from '../lib/orchestrator/queue';

async function cleanupOldJobs() {
  const queue = getProcessingQueue();
  
  console.log('\n🧹 Очистка старых задач из очереди...\n');
  
  try {
    // Получить все завершенные задачи
    const completed = await queue.getCompleted(0, 10000);
    console.log(`📊 Всего завершенных задач: ${completed.length}`);
    
    // Дата отсечки: 12 декабря 2025 00:00:00 UTC
    // Удаляем все задачи завершенные 11 декабря или раньше
    const cutoffDate = new Date('2025-12-12T00:00:00Z');
    console.log(`📅 Дата отсечки: ${cutoffDate.toISOString()}`);
    console.log(`   (удаляем задачи до 11 декабря включительно)\n`);
    
    // Фильтруем старые задачи
    const oldJobs = completed.filter((job) => {
      if (!job.finishedOn) return false;
      const finishedDate = new Date(job.finishedOn);
      return finishedDate <= cutoffDate;
    });
    
    console.log(`🔍 Найдено старых задач: ${oldJobs.length}`);
    
    if (oldJobs.length === 0) {
      console.log('✅ Нет старых задач для удаления\n');
      return;
    }
    
    // Показываем первые 10 для примера
    console.log('\n📋 Примеры задач для удаления:');
    oldJobs.slice(0, 10).forEach((job) => {
      const date = job.finishedOn ? new Date(job.finishedOn).toISOString() : 'N/A';
      console.log(`   - ${job.id}: ${date}`);
    });
    if (oldJobs.length > 10) {
      console.log(`   ... и ещё ${oldJobs.length - 10} задач`);
    }
    
    console.log('\n🗑️  Удаление старых задач...');
    let deleted = 0;
    let errors = 0;
    
    for (const job of oldJobs) {
      try {
        await job.remove();
        deleted++;
      } catch (error) {
        console.error(`   ❌ Ошибка при удалении ${job.id}:`, error instanceof Error ? error.message : error);
        errors++;
      }
    }
    
    console.log(`\n✅ Успешно удалено: ${deleted}`);
    if (errors > 0) {
      console.log(`⚠️  Ошибок при удалении: ${errors}`);
    }
    
    // Проверяем результат
    const remainingCompleted = await queue.getCompletedCount();
    console.log(`\n📊 Осталось завершенных задач: ${remainingCompleted}\n`);
    
  } catch (error) {
    console.error('❌ Ошибка при очистке:', error);
    throw error;
  } finally {
    await queue.close();
  }
}

cleanupOldJobs()
  .then(() => {
    console.log('✅ Очистка завершена\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Фатальная ошибка:', error);
    process.exit(1);
  });




