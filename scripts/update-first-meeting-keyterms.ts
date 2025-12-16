/**
 * Script to update keyterms for First Meeting Scenario
 * Usage: npx tsx scripts/update-first-meeting-keyterms.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateFirstMeetingKeyterms() {
  console.log('🔧 Updating keyterms for First Meeting Scenario...\n');

  try {
    // Find First meeting type
    const firstMeetingType = await prisma.meetingType.findFirst({
      where: { name: 'First' },
    });

    if (!firstMeetingType) {
      console.error('❌ First meeting type not found');
      return;
    }

    console.log(`✅ Found meeting type: ${firstMeetingType.name} (${firstMeetingType.id})\n`);

    // Find First Meeting Scenario
    const scenario = await prisma.promptScenario.findFirst({
      where: {
        meetingTypeId: firstMeetingType.id,
        name: 'Default First Meeting Scenario',
      },
    });

    if (!scenario) {
      console.error('❌ First Meeting Scenario not found');
      return;
    }

    console.log(`✅ Found scenario: ${scenario.name} (${scenario.id})\n`);

    // Keyterms list
    const keyterms = [
      'Лидспейс',
      '3DGroup',
      'Битрикс24',
      'WhatsApp',
      'Telegram',
      'Авито',
      'Сайт',
      'Заявка',
      'Заявки',
      'Интеграция мессенджеров',
      'Интеграция с сайтом',
      'Интеграция с телефонией',
      'CRM-система',
      'Клиентская база',
      'Карточка клиента',
      'Статусы',
      'Стадия',
      'Воронка',
      'Лиды',
      'Сделка',
      'Автоматизация',
      'Обязательное поле',
      'Роботы',
      'Триггеры',
      'Контакт-центр',
      'Запись встречи',
      'Ссылка на запись',
      'Видеовстреча',
      'Онлайн-встреча',
      'Коммерческое предложение',
      'КП',
      'Резюме',
      'Техподдержка',
      'Период адаптации',
      'Внедрение',
      'Wazzup',
      'WhatsApp Business',
      'Email',
      'Почта',
      'IP-телефония',
      'SIP',
      '1С',
      'WordPress',
      'Маркетплейс',
      'Битрикс24 Маркетплейс',
      'Лицензия',
      'Тариф',
      'Коробочная версия',
      'Облачная версия',
      'Техническое задание',
      'ТЗ',
      'Предпроектное исследование',
      'Бизнес-процесс',
      'Бизнес-процессы',
      'Задачи и Проекты',
      'Шаблоны документов',
      'Договор',
      'Акт',
    ];

    // Normalize keyterms: trim and remove duplicates
    const normalizedKeyterms = Array.from(
      new Set(
        keyterms
          .map((k) => k.trim())
          .filter((k) => k.length > 0)
      )
    );

    console.log(`📝 Updating with ${normalizedKeyterms.length} keyterms:\n`);
    normalizedKeyterms.forEach((kt, idx) => {
      console.log(`   ${idx + 1}. ${kt}`);
    });
    console.log();

    // Update scenario
    const updatedScenario = await prisma.promptScenario.update({
      where: { id: scenario.id },
      data: {
        keyterms: normalizedKeyterms,
        version: scenario.version + 1, // Increment version
      },
      select: {
        id: true,
        name: true,
        keyterms: true,
        version: true,
      },
    });

    console.log('✅ Scenario updated successfully!\n');
    console.log(`   ID: ${updatedScenario.id}`);
    console.log(`   Name: ${updatedScenario.name}`);
    console.log(`   Version: ${updatedScenario.version}`);
    console.log(`   Keyterms count: ${updatedScenario.keyterms.length}\n`);
  } catch (error) {
    console.error('❌ Error updating scenario:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateFirstMeetingKeyterms();







