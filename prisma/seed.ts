/**
 * Prisma Seed File
 * Seeds initial data: admin user, meeting types, and basic scenarios
 */

import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { generateShortId } from '../lib/db/id-generator';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Create admin user
  const adminPassword = 'Admin123!'; // Default password - should be changed in production
  const adminPasswordHash = await bcrypt.hash(adminPassword, 10);

  // Check if admin user exists
  let adminUser = await prisma.user.findUnique({
    where: { email: 'admin@aam.local' },
  });

  if (!adminUser) {
    const adminUserId = await generateShortId('user');
    adminUser = await prisma.user.create({
      data: {
        id: adminUserId,
        email: 'admin@aam.local',
        passwordHash: adminPasswordHash,
        name: 'Admin User',
        role: UserRole.ADMIN,
        isActive: true,
      },
    });
  }

  console.log('✅ Created admin user:', adminUser.email);

  // Create regular user
  const userPassword = 'User123!'; // Default password - should be changed in production
  const userPasswordHash = await bcrypt.hash(userPassword, 10);

  // Check if regular user exists
  let regularUser = await prisma.user.findUnique({
    where: { email: 'user@aam.local' },
  });

  if (!regularUser) {
    const regularUserId = await generateShortId('user');
    regularUser = await prisma.user.create({
      data: {
        id: regularUserId,
        email: 'user@aam.local',
        passwordHash: userPasswordHash,
        name: 'Regular User',
        role: UserRole.USER,
        isActive: true,
      },
    });
  }

  console.log('✅ Created regular user:', regularUser.email);

  // Create meeting types
  // Since MeetingType doesn't have unique name, delete existing and create new
  // First delete scenarios that reference meeting types
  await prisma.promptScenario.deleteMany({});
  // Then delete meeting types
  await prisma.meetingType.deleteMany({});
  
  const meetingTypeFirstId = await generateShortId('meeting_type');
  const meetingTypeFirst = await prisma.meetingType.create({
    data: { 
      id: meetingTypeFirstId,
      name: 'First', 
      isActive: true 
    },
  });
  
  const meetingTypeFollowUpId = await generateShortId('meeting_type');
  const meetingTypeFollowUp = await prisma.meetingType.create({
    data: { 
      id: meetingTypeFollowUpId,
      name: 'Follow-up', 
      isActive: true 
    },
  });
  
  const meetingTypeCPId = await generateShortId('meeting_type');
  const meetingTypeCP = await prisma.meetingType.create({
    data: { 
      id: meetingTypeCPId,
      name: 'CP Presentation', 
      isActive: true 
    },
  });

  console.log('✅ Created meeting types');

  // Create basic prompt scenarios (minimal JSON schemas)
  const basicOutputSchema = {
    type: 'object',
    properties: {
      artifacts: {
        type: 'object',
        properties: {},
      },
      quality: {
        type: 'object',
        properties: {
          missing_data_items: {
            type: 'array',
            items: { type: 'string' },
          },
          notes: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['missing_data_items', 'notes'],
      },
    },
    required: ['artifacts', 'quality'],
  };

  // First meeting specific configuration (updated order and sections)
  const firstMeetingArtifactsConfig = {
    sections: [
      { key: 'meta', label: 'Метаданные', order: 1, visible: true },
      { key: 'client_profile', label: 'Профиль клиента', order: 2, visible: true },
      {
        key: 'proposal_ready_materials',
        label: 'Материалы для предложения',
        order: 3,
        visible: true,
      },
      { key: 'pains', label: 'Боли клиента', order: 4, visible: true },
      { key: 'tasks_and_requirements', label: 'Задачи и требования', order: 5, visible: true },
      { key: 'bitrix24_scope_draft', label: 'Битрикс24 Scope', order: 6, visible: true },
      { key: 'quality', label: 'Качество данных', order: 7, visible: true },
    ],
  };

  // Basic artifacts config for Follow-up meeting type
  const basicArtifactsConfig = {
    sections: [
      { key: 'meta', label: 'Метаданные встречи', order: 1, visible: true },
      { key: 'client_profile', label: 'Профиль клиента', order: 2, visible: true },
      {
        key: 'decision_and_stakeholders',
        label: 'Решения и стейкхолдеры',
        order: 3,
        visible: true,
      },
      { key: 'pains', label: 'Боли клиента', order: 4, visible: true },
      { key: 'tasks_and_requirements', label: 'Задачи и требования', order: 5, visible: true },
      { key: 'process_map', label: 'Карта процессов', order: 6, visible: true },
      {
        key: 'channels_and_integrations',
        label: 'Каналы и интеграции',
        order: 7,
        visible: true,
      },
      { key: 'numbers_and_terms', label: 'Бюджет и сроки', order: 8, visible: true },
      { key: 'bitrix24_scope_draft', label: 'Bitrix24 Scope', order: 9, visible: true },
      {
        key: 'proposal_ready_materials',
        label: 'Материалы для предложения',
        order: 10,
        visible: true,
      },
      {
        key: 'gaps_for_regeneration',
        label: 'Пробелы для регенерации',
        order: 11,
        visible: true,
      },
      { key: 'quality_checks', label: 'Проверки качества', order: 12, visible: true },
      { key: 'quality', label: 'Качество данных', order: 13, visible: true },
    ],
  };

  // CP Presentation specific configuration
  const cpPresentationArtifactsConfig = {
    sections: [
      { key: 'meta', label: 'Метаданные встречи', order: 1, visible: true },
      { key: 'client_profile', label: 'Профиль клиента', order: 2, visible: true },
      { key: 'kp_presentation', label: 'Презентация КП', order: 3, visible: true },
      { key: 'client_feedback_on_kp', label: 'Обратная связь по КП', order: 4, visible: true },
      { key: 'client_decision_and_position', label: 'Решение и позиция клиента', order: 5, visible: true },
      { key: 'next_steps', label: 'Следующие шаги', order: 6, visible: true },
      { key: 'risk_assessment', label: 'Оценка рисков', order: 7, visible: true },
      { key: 'sales_manager_assessment', label: 'Оценка менеджера', order: 8, visible: true },
      { key: 'quality', label: 'Качество данных', order: 9, visible: true },
    ],
  };

  // Create scenario for First meeting type
  const scenarioFirstId = await generateShortId('prompt_scenario');
  await prisma.promptScenario.create({
    data: {
      id: scenarioFirstId,
      meetingTypeId: meetingTypeFirst.id,
      name: 'Default First Meeting Scenario',
      systemPrompt: 'Extract key information from the meeting transcript.',
      outputSchema: basicOutputSchema,
      artifactsConfig: firstMeetingArtifactsConfig,
      keyterms: [], // Empty by default, can be configured later
      isActive: true,
      version: 1,
      updatedByUserId: adminUser.id,
    },
  });

  // Create scenario for Follow-up meeting type
  const scenarioFollowUpId = await generateShortId('prompt_scenario');
  await prisma.promptScenario.create({
    data: {
      id: scenarioFollowUpId,
      meetingTypeId: meetingTypeFollowUp.id,
      name: 'Default Follow-up Meeting Scenario',
      systemPrompt: 'Extract key information from the follow-up meeting transcript.',
      outputSchema: basicOutputSchema,
      artifactsConfig: basicArtifactsConfig,
      keyterms: [], // Empty by default, can be configured later
      isActive: true,
      version: 1,
      updatedByUserId: adminUser.id,
    },
  });

  // Create scenario for CP Presentation meeting type
  const scenarioCPId = await generateShortId('prompt_scenario');
  await prisma.promptScenario.create({
    data: {
      id: scenarioCPId,
      meetingTypeId: meetingTypeCP.id,
      name: 'Default CP Presentation Scenario',
      systemPrompt: 'Extract key information from the CP presentation meeting transcript.',
      outputSchema: basicOutputSchema,
      artifactsConfig: cpPresentationArtifactsConfig,
      keyterms: [], // Empty by default, can be configured later
      isActive: true,
      version: 1,
      updatedByUserId: adminUser.id,
    },
  });

  console.log('✅ Created prompt scenarios');

  // Create test clients (companies)
  const testClients = [
    {
      name: 'ТехноСофт Решения',
      clientContextSummaryMd: `# ТехноСофт Решения

## О компании
Крупная IT-компания, специализирующаяся на разработке корпоративного ПО и цифровых решений.

## Основные направления
- Разработка CRM-систем
- Интеграционные решения
- Облачные сервисы
- Автоматизация бизнес-процессов

## Контакты
- Руководитель проекта: Иван Петров
- Email: petrov@technosoft.ru
- Телефон: +7 (495) 123-45-67`,
    },
    {
      name: 'Финансовый Альянс',
      clientContextSummaryMd: `# Финансовый Альянс

## О компании
Международная финансовая группа с офисами в России и странах СНГ. Предоставляет комплексные финансовые услуги для бизнеса.

## Основные направления
- Инвестиционное консультирование
- Управление активами
- Финансовое планирование
- Корпоративное кредитование

## Контакты
- Менеджер по работе с клиентами: Мария Сидорова
- Email: sidorova@finansalians.ru
- Телефон: +7 (495) 234-56-78`,
    },
    {
      name: 'МегаТрейд',
      clientContextSummaryMd: `# МегаТрейд

## О компании
Сеть розничных магазинов электроники и бытовой техники. Более 50 точек продаж в крупных городах России.

## Основные направления
- Розничная торговля
- Онлайн-продажи
- Корпоративные продажи
- Обслуживание и ремонт

## Контакты
- Директор по развитию: Алексей Козлов
- Email: kozlov@megatrade.ru
- Телефон: +7 (495) 345-67-89`,
    },
    {
      name: 'Медицинские Системы Плюс',
      clientContextSummaryMd: `# Медицинские Системы Плюс

## О компании
Разработчик медицинского оборудования и программного обеспечения для клиник и медицинских центров.

## Основные направления
- Медицинское оборудование
- Информационные системы для здравоохранения
- Телемедицина
- Консалтинг в сфере медицины

## Контакты
- Коммерческий директор: Елена Волкова
- Email: volkova@medsystems-plus.ru
- Телефон: +7 (495) 456-78-90`,
    },
    {
      name: 'ЭкоЭнерго Групп',
      clientContextSummaryMd: `# ЭкоЭнерго Групп

## О компании
Компания, специализирующаяся на возобновляемых источниках энергии и энергоэффективных технологиях.

## Основные направления
- Солнечная энергетика
- Ветровая энергетика
- Энергоэффективные решения
- Экологическое консультирование

## Контакты
- Руководитель проектов: Дмитрий Новиков
- Email: novikov@ecoenergo.ru
- Телефон: +7 (495) 567-89-01`,
    },
  ];

  // Create test clients (skip if already exist)
  for (const clientData of testClients) {
    const existingClient = await prisma.client.findFirst({
      where: { name: clientData.name },
    });

    if (!existingClient) {
      const clientId = await generateShortId('client');
      await prisma.client.create({
        data: {
          id: clientId,
          name: clientData.name,
          clientContextSummaryMd: clientData.clientContextSummaryMd,
          createdByUserId: adminUser.id,
        },
      });
    } else {
      // Update existing client's context if needed
      await prisma.client.update({
        where: { id: existingClient.id },
        data: {
          clientContextSummaryMd: clientData.clientContextSummaryMd,
        },
      });
    }
  }

  console.log(`✅ Created ${testClients.length} test clients`);
  console.log('🎉 Seed completed successfully!');
  console.log(`\n📝 Admin credentials:\n   Email: ${adminUser.email}\n   Password: ${adminPassword}`);
  console.log(`\n📝 User credentials:\n   Email: ${regularUser.email}\n   Password: ${userPassword}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

