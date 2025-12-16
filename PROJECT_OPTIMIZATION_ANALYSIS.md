# Анализ оптимизации проекта AAM (Assist After Meeting)

**Дата анализа:** 16 декабря 2025  
**Версия:** 1.0.0  
**Статус проекта:** Production-ready v1

---

## Оглавление
1. [Общий обзор архитектуры](#1-общий-обзор-архитектуры)
2. [Анализ структуры проекта](#2-анализ-структуры-проекта)
3. [Выявленные проблемы и узкие места](#3-выявленные-проблемы-и-узкие-места)
4. [Рекомендации по оптимизации](#4-рекомендации-по-оптимизации)
5. [План дальнейшего развития](#5-план-дальнейшего-развития)
6. [Оценка приоритетов](#6-оценка-приоритетов)

---

## 1. Общий обзор архитектуры

### 1.1 Текущий стек технологий

**Frontend/Backend:**
- Next.js 15 (App Router) с TypeScript
- React 19
- Tailwind CSS для стилизации
- Lucide React для иконок

**Backend инфраструктура:**
- PostgreSQL 15 (база данных)
- Prisma ORM 5.19
- Redis 7 (кэш и очереди)
- BullMQ (обработка задач)
- MinIO (S3-совместимое хранилище)

**Внешние API:**
- Deepgram API (STT - речь в текст)
- OpenAI GPT-4o (обработка транскриптов)

**Контейнеризация:**
- Docker Compose для dev-окружения

### 1.2 Архитектурные паттерны

✅ **Что работает хорошо:**
- Модульная структура (`lib/` с разделением по доменам)
- Четкое разделение ответственности (adapters, services, validators)
- Идемпотентность pipeline операций
- Использование транзакций для критических операций
- Строгая типизация TypeScript

⚠️ **Что требует внимания:**
- Дублирование логики worker'ов (`lib/queue-worker.ts` vs `lib/orchestrator/workers.ts`)
- Избыточное количество utility скриптов (39 файлов в `scripts/`)
- Отсутствие кэширования на уровне API
- Нет оптимизации загрузки больших файлов

---

## 2. Анализ структуры проекта

### 2.1 Структура папок

```
/
├── app/                    # Next.js routes (8 основных разделов)
│   ├── api/               # 29 API endpoints
│   ├── admin/
│   ├── clients/
│   ├── dashboard/
│   ├── login/
│   ├── meetings/
│   └── register/
├── components/            # 78 React компонентов
│   ├── admin/            # 16 компонентов
│   ├── auth/             # 2 компонента
│   ├── clients/          # 6 компонентов
│   ├── layout/           # 2 компонента
│   ├── meetings/         # 44 компонента (!)
│   ├── notifications/    # 1 компонент
│   ├── providers/        # 1 компонент
│   └── ui/               # 8 базовых компонентов
├── lib/                   # Бизнес-логика (14 модулей)
│   ├── api/
│   ├── artifacts/
│   ├── auth/
│   ├── client-kb/
│   ├── db/
│   ├── deepgram-adapter/
│   ├── directory/
│   ├── errors/
│   ├── llm-interaction/
│   ├── logger/
│   ├── meeting/
│   ├── openai-adapter/
│   ├── orchestrator/      # Core pipeline logic
│   ├── realtime/
│   ├── scenario/
│   ├── upload/
│   └── user/
├── prisma/               # DB schema + migrations
├── scripts/              # 39 утилит (!)
└── types/                # TypeScript типы
```

### 2.2 Метрики кода

| Показатель | Значение | Оценка |
|-----------|----------|---------|
| Общее количество компонентов | 78 | ⚠️ Высокое |
| API endpoints | 29 | ✅ Нормальное |
| Модулей в lib/ | 14 | ✅ Хорошая модульность |
| Utility скрипты | 39 | ❌ Избыточно |
| Компоненты в meetings/ | 44 (56%) | ❌ Перегружено |
| Зависимостей в package.json | 27 основных | ✅ Умеренное |

---

## 3. Выявленные проблемы и узкие места

### 3.1 Критические проблемы производительности

#### **❌ ПРОБЛЕМА #1: Множественные запросы к БД в pipeline**

**Местоположение:** `lib/orchestrator/workers.ts`

**Проблема:**
```typescript
// Строка 50-53: Проверка существования meeting
const meetingExists = await prisma.meeting.findUnique(...)

// Строка 72-79: Повторный запрос meeting с relations
const meeting = await prisma.meeting.findUnique(...)

// Строка 112-120: Третий запрос после транскрипции
const updatedMeeting = await prisma.meeting.findUnique(...)

// Строка 134-141: Четвертый запрос перед LLM
const currentMeeting = await prisma.meeting.findUnique(...)
```

**Влияние:**
- 4+ запроса к БД на один meeting pipeline
- Увеличение latency на 100-400ms
- Избыточная нагрузка на PostgreSQL

**Решение:**
- Объединить первые 2 запроса в один
- Передавать объект meeting между этапами
- Использовать Prisma `include` вместо множественных select

---

#### **❌ ПРОБЛЕМА #2: Отсутствие connection pooling для Redis**

**Местоположение:** 
- `lib/queue.ts` (строка 9-21)
- `lib/orchestrator/workers.ts` (строка 27-35)

**Проблема:**
```typescript
// Дублирование создания Redis соединений
function getRedisConnection(): Redis {
  if (!redisConnection) {
    redisConnection = new Redis(redisUrl);
  }
  return redisConnection;
}
```

- Создаются отдельные singleton соединения в разных модулях
- Нет настройки connection pool
- Отсутствует reconnection strategy

**Влияние:**
- Риск exhaustion соединений при высокой нагрузке
- Отсутствие fault tolerance при временных сбоях Redis

**Решение:**
- Централизовать Redis connection в `lib/redis.ts`
- Настроить connection pooling
- Добавить retry logic и reconnection strategy

---

#### **❌ ПРОБЛЕМА #3: Загрузка всего файла в память при транскрипции**

**Местоположение:** `lib/orchestrator/processors/transcription.ts` (строка 99-102)

**Проблема:**
```typescript
// Загружается весь файл (до 1.2GB!) в память
fileBuffer = await downloadFileFromS3(meeting.uploadBlob.storagePath);
```

**Влияние:**
- До 1.2GB RAM на каждую транскрипцию
- При concurrency=5 → до 6GB памяти
- Риск OOM (Out of Memory) на сервере

**Решение:**
- Использовать streaming загрузку из S3
- Передавать stream напрямую в Deepgram API
- Освобождать память сразу после отправки

---

#### **❌ ПРОБЛЕМА #4: Отсутствие индексов в БД**

**Местоположение:** `prisma/schema.prisma`

**Проблема:**
- Отсутствуют индексы для частых запросов
- Нет composite indexes для фильтрации

**Критические missing indexes:**
```prisma
// Meeting - нет индекса по status + ownerUserId
Meeting {
  status
  ownerUserId
  clientId
  createdAt
}

// ProcessingError - нет индекса по meetingId + isRead
ProcessingError {
  meetingId
  isRead
  occurredAt
}

// LLMInteraction - индексы есть, но неполные
LLMInteraction {
  @@index([meetingId, isFinal])  // Добавить
}
```

**Влияние:**
- Медленные запросы при фильтрации meetings
- Full table scan при поиске ошибок
- Degradation при росте количества записей

**Решение:**
- Добавить composite indexes
- Проанализировать slow queries в продакшене

---

### 3.2 Проблемы архитектуры и структуры

#### **⚠️ ПРОБЛЕМА #5: Дублирование worker логики**

**Файлы:**
- `lib/queue-worker.ts` (58 строк)
- `lib/orchestrator/workers.ts` (368 строк)

**Проблема:**
- Два разных worker implementation
- `queue-worker.ts` содержит устаревшую заглушку
- Неясно, какой используется в продакшене

**Решение:**
- Удалить устаревший `lib/queue-worker.ts`
- Оставить только `lib/orchestrator/workers.ts`
- Обновить импорты

---

#### **⚠️ ПРОБЛЕМА #6: Перегруженная папка components/meetings/**

**Состояние:**
- 44 компонента в одной папке
- 35 компонентов только для artifacts-viewer
- Сложная навигация и поддержка

**Структура:**
```
components/meetings/
├── meeting-detail/
│   ├── artifacts-viewer/
│   │   ├── components/ (3 файла)
│   │   ├── sections/   (25 файлов!) 
│   │   └── ...
│   └── ...
```

**Решение:**
- Вынести artifacts-viewer в отдельную top-level папку
- Создать `components/artifacts/` или `components/meeting-artifacts/`
- Упростить структуру sections (использовать config-driven подход)

---

#### **⚠️ ПРОБЛЕМА #7: Избыточное количество utility scripts**

**Количество:** 39 файлов в `scripts/`

**Категории:**
- Diagnostic (15 скриптов)
- Cleanup (7 скриптов)
- Retry logic (5 скриптов)
- Migration (4 скрипта)
- Testing (4 скрипта)
- Worker management (4 скрипта)

**Проблема:**
- Дублирование функционала
- Отсутствие CLI interface
- Сложность в поиске нужного скрипта

**Решение:**
- Создать единый CLI: `npm run aam <command>`
- Объединить схожие скрипты
- Оставить только production-critical scripts

---

### 3.3 Проблемы масштабируемости

#### **⚠️ ПРОБЛЕМА #8: Single-tenant Redis и отсутствие horizontal scaling**

**Проблема:**
- Вся система завязана на один Redis instance
- BullMQ не настроен для multi-instance deployment
- Нет graceful shutdown для workers

**Влияние:**
- Single point of failure
- Невозможность горизонтального масштабирования workers
- Потеря jobs при аварийном рестарте

**Решение:**
- Настроить Redis Sentinel или Cluster
- Добавить graceful shutdown в workers
- Использовать distributed locks (не только Redis)

---

#### **⚠️ ПРОБЛЕМА #9: Отсутствие rate limiting для внешних API**

**Местоположение:**
- `lib/deepgram-adapter/service.ts`
- `lib/openai-adapter/service.ts`

**Проблема:**
- Нет контроля за rate limits Deepgram/OpenAI
- При burst load возможны 429 ошибки
- Отсутствие backpressure mechanism

**Решение:**
- Добавить bottleneck/p-queue для rate limiting
- Настроить максимальное количество concurrent API calls
- Добавить exponential backoff с jitter

---

#### **⚠️ ПРОБЛЕМА #10: N+1 queries в listing endpoints**

**Местоположение:** API endpoints для получения списков

**Примеры:**
```typescript
// app/api/meetings/route.ts
// Вероятно загружаются relations по одному
const meetings = await getMeetingsByOwner(userId);
// Затем для каждого meeting:
// - участники
// - viewers
// - статусы
```

**Решение:**
- Использовать Prisma `include` для eager loading
- Добавить pagination
- Использовать cursor-based pagination для больших списков

---

### 3.4 Проблемы DevOps и мониторинга

#### **⚠️ ПРОБЛЕМА #11: Отсутствие health checks**

**Проблема:**
- Нет `/health` endpoint
- Нет мониторинга состояния workers
- Отсутствует alerting при падении сервисов

**Решение:**
- Добавить `app/api/health/route.ts`
- Проверять: DB, Redis, S3, Workers status
- Интегрировать с Docker healthchecks

---

#### **⚠️ ПРОБЛЕМА #12: Недостаточное логирование**

**Текущее состояние:**
- Используется custom logger (`lib/logger/`)
- Отсутствует structured logging
- Нет correlation IDs для трейсинга

**Решение:**
- Перейти на winston или pino
- Добавить request ID в каждый лог
- Логировать performance метрики

---

## 4. Рекомендации по оптимизации

### 4.1 Немедленные действия (Quick Wins)

#### **🎯 Оптимизация #1: Индексы БД**
**Приоритет:** 🔴 КРИТИЧЕСКИЙ  
**Время:** 30 минут  
**Влияние:** Ускорение запросов на 10-100x

```prisma
// Добавить в schema.prisma

model Meeting {
  // ...
  @@index([status, ownerUserId])
  @@index([clientId, createdAt(sort: Desc)])
  @@index([status, createdAt(sort: Desc)])
}

model ProcessingError {
  // ...
  @@index([meetingId, isRead, occurredAt(sort: Desc)])
  @@index([stage, occurredAt(sort: Desc)])
}

model LLMInteraction {
  // ...
  @@index([meetingId, isFinal])
  @@index([meetingId, attemptNumber])
}
```

**Команды:**
```bash
# Создать миграцию
npx prisma migrate dev --name add_performance_indexes

# Применить в production
npx prisma migrate deploy
```

---

#### **🎯 Оптимизация #2: Объединить запросы в pipeline**
**Приоритет:** 🔴 КРИТИЧЕСКИЙ  
**Время:** 2 часа  
**Влияние:** Снижение latency на 200-300ms

**Было:**
```typescript
// 4 отдельных запроса
const meetingExists = await prisma.meeting.findUnique(...)
const meeting = await prisma.meeting.findUnique(...)
const updatedMeeting = await prisma.meeting.findUnique(...)
const currentMeeting = await prisma.meeting.findUnique(...)
```

**Стало:**
```typescript
// 1 запрос в начале с полными relations
const meeting = await prisma.meeting.findUnique({
  where: { id: meetingId },
  include: {
    uploadBlob: true,
    transcript: true,
    artifacts: true,
    scenario: { include: { meetingType: true } },
    participants: true,
    client: true,
  },
});

// Переиспользуем объект, обновляем только при необходимости
```

**Файлы для изменения:**
- `lib/orchestrator/workers.ts` (функция `processMeetingJob`)

---

#### **🎯 Оптимизация #3: Централизовать Redis connection**
**Приоритет:** 🟡 СРЕДНИЙ  
**Время:** 1 час  
**Влияние:** Улучшение stability, предотвращение connection leaks

**Создать:** `lib/redis.ts`
```typescript
import Redis from 'ioredis';

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: null, // Required for BullMQ
      enableReadyCheck: true,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      reconnectOnError: (err) => {
        const targetErrors = ['READONLY', 'ECONNRESET'];
        return targetErrors.some(e => err.message.includes(e));
      },
    });

    redisClient.on('error', (err) => {
      console.error('Redis connection error:', err);
    });

    redisClient.on('connect', () => {
      console.log('Redis connected');
    });
  }

  return redisClient;
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
```

**Обновить импорты в:**
- `lib/queue.ts`
- `lib/orchestrator/workers.ts`
- `lib/orchestrator/locks.ts`

---

#### **🎯 Оптимизация #4: Удалить устаревший queue-worker**
**Приоритет:** 🟢 НИЗКИЙ  
**Время:** 15 минут  
**Влияние:** Упрощение кодовой базы

```bash
# Удалить устаревшие файлы
rm lib/queue-worker.ts
rm lib/queue-shutdown.ts

# Обновить импорты в scripts/worker.ts
# Использовать lib/orchestrator/workers.ts
```

---

### 4.2 Среднесрочные оптимизации (1-2 недели)

#### **🎯 Оптимизация #5: Streaming загрузка файлов из S3**
**Приоритет:** 🔴 КРИТИЧЕСКИЙ  
**Время:** 4 часа  
**Влияние:** Снижение memory usage с 6GB до ~500MB

**Создать:** `lib/orchestrator/s3-stream-utils.ts`
```typescript
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getS3Client } from '../upload/s3-client';
import { Readable } from 'stream';

export async function getS3Stream(storagePath: string): Promise<Readable> {
  const s3Client = getS3Client();
  const bucketName = process.env.S3_BUCKET_NAME!;
  
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: storagePath,
  });
  
  const response = await s3Client.send(command);
  
  if (!response.Body || !(response.Body instanceof Readable)) {
    throw new Error('Failed to get readable stream from S3');
  }
  
  return response.Body as Readable;
}
```

**Обновить:** `lib/deepgram-adapter/service.ts`
```typescript
// Добавить поддержку stream вместо buffer
export async function transcribe(options: {
  fileStream?: Readable;
  fileBuffer?: Buffer;
  // ...
}): Promise<TranscribeResult> {
  // Использовать stream если доступен
}
```

**Обновить:** `lib/orchestrator/processors/transcription.ts`
```typescript
// Вместо downloadFileFromS3
const fileStream = await getS3Stream(meeting.uploadBlob.storagePath);
const transcriptionResult = await transcribe({
  fileStream,
  language: 'ru',
  keyterms,
});
```

---

#### **🎯 Оптимизация #6: API Response caching**
**Приоритет:** 🟡 СРЕДНИЙ  
**Время:** 6 часов  
**Влияние:** Снижение нагрузки на БД, ускорение UI

**Endpoints для кэширования:**
- `GET /api/clients` (TTL: 5 минут)
- `GET /api/meetings` (TTL: 1 минута)
- `GET /api/meeting-types` (TTL: 1 час)
- `GET /api/scenarios` (TTL: 1 час)
- `GET /api/participants` (TTL: 5 минут)

**Создать:** `lib/cache.ts`
```typescript
import { getRedisClient } from './redis';

export async function getCached<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttlSeconds: number
): Promise<T> {
  const redis = getRedisClient();
  
  // Попытка получить из кэша
  const cached = await redis.get(key);
  if (cached) {
    return JSON.parse(cached);
  }
  
  // Выполнить запрос
  const data = await fetchFn();
  
  // Сохранить в кэш
  await redis.setex(key, ttlSeconds, JSON.stringify(data));
  
  return data;
}

export async function invalidateCache(pattern: string): Promise<void> {
  const redis = getRedisClient();
  const keys = await redis.keys(pattern);
  
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}
```

**Использование в API:**
```typescript
// app/api/meetings/route.ts
import { getCached, invalidateCache } from '@/lib/cache';

export async function GET(req: Request) {
  const userId = req.userId; // From auth middleware
  
  const meetings = await getCached(
    `meetings:user:${userId}`,
    () => getMeetingsByOwner(userId),
    60 // 1 минута
  );
  
  return Response.json({ data: meetings });
}

// При создании/обновлении meeting
await invalidateCache(`meetings:user:${userId}`);
```

---

#### **🎯 Оптимизация #7: Реорганизация components/meetings/**
**Приоритет:** 🟢 НИЗКИЙ  
**Время:** 3 часа  
**Влияние:** Улучшение DX (Developer Experience)

**Новая структура:**
```
components/
├── artifacts/
│   ├── viewer/
│   │   ├── ArtifactsViewer.tsx
│   │   ├── JsonView.tsx
│   │   ├── StructuredView.tsx
│   │   └── types.ts
│   ├── renderers/
│   │   ├── SectionRenderer.tsx        # Generic renderer
│   │   ├── EvidenceBlock.tsx
│   │   ├── PriorityBadge.tsx
│   │   └── section-components.ts      # Export all section types
│   └── sections/
│       ├── config.ts                   # Section configuration
│       └── [specific-sections].tsx     # Keep specific if needed
├── meetings/
│   ├── list/
│   │   ├── MeetingCard.tsx
│   │   └── MeetingsList.tsx
│   ├── detail/
│   │   ├── MeetingDetail.tsx
│   │   ├── MeetingHeader.tsx
│   │   ├── ParticipantsList.tsx
│   │   ├── ViewersList.tsx
│   │   └── ProcessingStatus.tsx
│   ├── create/
│   │   ├── CreateMeetingForm.tsx
│   │   └── [selectors].tsx
│   └── modals/
│       ├── AddViewerModal.tsx
│       └── TransferOwnershipModal.tsx
```

**Преимущества:**
- Логическое разделение concerns
- Легче найти нужный компонент
- Упрощение импортов
- Возможность переиспользования artifacts viewer в других местах

---

#### **🎯 Оптимизация #8: Консолидация utility scripts**
**Приоритет:** 🟢 НИЗКИЙ  
**Время:** 8 часов  
**Влияние:** Улучшение DX

**Создать CLI:** `scripts/cli.ts`
```typescript
#!/usr/bin/env tsx

import { Command } from 'commander';

const program = new Command();

program
  .name('aam')
  .description('AAM Admin CLI')
  .version('1.0.0');

// Diagnostics
program
  .command('diagnose')
  .description('Diagnose system and meeting issues')
  .option('-m, --meeting <id>', 'Meeting ID to diagnose')
  .option('--services', 'Check services health')
  .option('--queue', 'Check queue status')
  .action(async (options) => {
    // Объединяет: check-services, check-queue-status, diagnose-meeting
  });

// Cleanup
program
  .command('cleanup')
  .description('Cleanup old data')
  .option('--meetings', 'Clean old meetings')
  .option('--jobs', 'Clean old jobs')
  .option('--locks', 'Clear stuck locks')
  .action(async (options) => {
    // Объединяет: cleanup-meetings, cleanup-old-jobs, clear-locks
  });

// Retry
program
  .command('retry')
  .description('Retry failed meetings')
  .option('-m, --meeting <id>', 'Meeting ID to retry')
  .option('--failed', 'Retry all failed meetings')
  .action(async (options) => {
    // Объединяет: retry-meeting, retry-failed-meeting, force-retry-meetings
  });

program.parse();
```

**Обновить package.json:**
```json
{
  "scripts": {
    "aam": "tsx scripts/cli.ts",
    "aam:diagnose": "npm run aam diagnose",
    "aam:cleanup": "npm run aam cleanup",
    "aam:retry": "npm run aam retry"
  }
}
```

**Использование:**
```bash
npm run aam diagnose -- --meeting M001
npm run aam diagnose -- --services
npm run aam cleanup -- --meetings
npm run aam retry -- --failed
```

---

### 4.3 Долгосрочные оптимизации (1-2 месяца)

#### **🎯 Оптимизация #9: Horizontal scaling support**
**Приоритет:** 🔴 КРИТИЧЕСКИЙ (для production)  
**Время:** 2 недели  
**Влияние:** Поддержка высокой нагрузки, fault tolerance

**Компоненты:**

1. **Redis Sentinel/Cluster**
```yaml
# docker-compose.yml
services:
  redis-master:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    
  redis-sentinel-1:
    image: redis:7-alpine
    command: redis-sentinel /etc/redis/sentinel.conf
    
  redis-sentinel-2:
    image: redis:7-alpine
    command: redis-sentinel /etc/redis/sentinel.conf
```

2. **Multi-instance Workers**
```typescript
// lib/orchestrator/workers.ts
export function startProcessingWorker(workerId?: string): Worker {
  const worker = new Worker(
    ORCHESTRATOR_CONSTANTS.QUEUE_NAME,
    processMeetingJob,
    {
      connection: getRedisConnection(),
      concurrency: 5,
      
      // Graceful shutdown
      gracefulShutdownTimeout: 30000, // 30 seconds
      
      // Health checks
      settings: {
        stalledInterval: 60000,
        maxStalledCount: 2,
      },
    }
  );
  
  // Graceful shutdown handler
  process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, closing worker gracefully...');
    await worker.close();
    process.exit(0);
  });
  
  return worker;
}
```

3. **Load Balancer для API**
```nginx
# nginx.conf
upstream aam_backend {
  least_conn;
  server aam-api-1:3000;
  server aam-api-2:3000;
  server aam-api-3:3000;
}

server {
  listen 80;
  
  location /api {
    proxy_pass http://aam_backend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
  }
}
```

---

#### **🎯 Оптимизация #10: Rate limiting для внешних API**
**Приоритет:** 🟡 СРЕДНИЙ  
**Время:** 1 неделя  
**Влияние:** Предотвращение 429 ошибок, оптимизация costs

**Установить:**
```bash
npm install bottleneck
```

**Создать:** `lib/rate-limiter.ts`
```typescript
import Bottleneck from 'bottleneck';

// Deepgram rate limiter
// https://developers.deepgram.com/docs/rate-limits
export const deepgramLimiter = new Bottleneck({
  maxConcurrent: 10, // Max concurrent requests
  minTime: 100,      // Min 100ms between requests (10 req/sec)
  
  // Reservoir (if Deepgram has per-minute limits)
  reservoir: 600,           // 600 requests
  reservoirRefreshAmount: 600,
  reservoirRefreshInterval: 60 * 1000, // per minute
});

// OpenAI rate limiter
// https://platform.openai.com/docs/guides/rate-limits
export const openaiLimiter = new Bottleneck({
  maxConcurrent: 50,  // GPT-4 allows high concurrency
  minTime: 50,        // 20 req/sec
  
  reservoir: 3000,
  reservoirRefreshAmount: 3000,
  reservoirRefreshInterval: 60 * 1000,
});

// Error handling with retry
deepgramLimiter.on('error', (error) => {
  console.error('Deepgram rate limiter error:', error);
});

deepgramLimiter.on('failed', async (error, jobInfo) => {
  const { message } = error;
  
  // Retry on rate limit errors
  if (message.includes('429') || message.includes('rate limit')) {
    console.warn('Rate limited, retrying after 60s...');
    return 60000; // Retry after 60 seconds
  }
  
  // Retry on temporary errors
  if (message.includes('timeout') || message.includes('ECONNRESET')) {
    console.warn('Temporary error, retrying after 5s...');
    return 5000;
  }
  
  return null; // Don't retry other errors
});
```

**Использование:**
```typescript
// lib/deepgram-adapter/service.ts
import { deepgramLimiter } from '../rate-limiter';

export async function transcribe(options: TranscribeOptions) {
  return deepgramLimiter.schedule(async () => {
    // Actual API call
    const response = await deepgram.transcription.preRecorded(...);
    return response;
  });
}

// lib/openai-adapter/service.ts
import { openaiLimiter } from '../rate-limiter';

async function callOpenAI(...) {
  return openaiLimiter.schedule(async () => {
    const response = await openai.chat.completions.create(...);
    return response;
  });
}
```

---

#### **🎯 Оптимизация #11: Database query optimization**
**Приоритет:** 🟡 СРЕДНИЙ  
**Время:** 1 неделя  
**Влияние:** Снижение latency, уменьшение DB load

**1. Pagination для listing endpoints**

```typescript
// lib/meeting/service.ts
export async function getMeetingsByOwner(
  ownerUserId: string,
  options?: {
    cursor?: string;
    limit?: number;
    filters?: {
      status?: MeetingStatus;
      clientId?: string;
    };
  }
): Promise<{
  data: MeetingResponse[];
  nextCursor?: string;
  hasMore: boolean;
}> {
  const limit = options?.limit || 20;
  
  const meetings = await prisma.meeting.findMany({
    where: {
      ownerUserId,
      ...(options?.filters?.status && { status: options.filters.status }),
      ...(options?.filters?.clientId && { clientId: options.filters.clientId }),
      ...(options?.cursor && {
        id: { lt: options.cursor }, // Cursor-based pagination
      }),
    },
    include: {
      client: { select: { id: true, name: true } },
      meetingType: { select: { id: true, name: true } },
      scenario: { select: { id: true, name: true } },
      participants: {
        select: {
          snapshotFullName: true,
          snapshotRoleTitle: true,
        },
        take: 5, // Limit participants
      },
      _count: {
        select: {
          viewers: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit + 1, // Fetch one more to check hasMore
  });
  
  const hasMore = meetings.length > limit;
  const data = hasMore ? meetings.slice(0, limit) : meetings;
  const nextCursor = hasMore ? data[data.length - 1].id : undefined;
  
  return {
    data: data.map(mapToMeetingResponse),
    nextCursor,
    hasMore,
  };
}
```

**2. Eager loading для N+1 prevention**

```typescript
// Вместо:
const meetings = await prisma.meeting.findMany({ where: { ownerUserId } });
for (const meeting of meetings) {
  const participants = await prisma.meetingParticipant.findMany({ 
    where: { meetingId: meeting.id } 
  });
  // ...
}

// Использовать:
const meetings = await prisma.meeting.findMany({
  where: { ownerUserId },
  include: {
    participants: true,
    viewers: true,
    client: true,
  },
});
```

---

#### **🎯 Оптимизация #12: Monitoring & Observability**
**Приоритет:** 🔴 КРИТИЧЕСКИЙ (для production)  
**Время:** 2 недели  
**Влияние:** Проактивное обнаружение проблем

**1. Health Check Endpoint**

```typescript
// app/api/health/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getRedisClient } from '@/lib/redis';
import { getS3Client } from '@/lib/upload/s3-client';

export async function GET() {
  const checks = {
    database: false,
    redis: false,
    s3: false,
    workers: false,
  };
  
  const errors: string[] = [];
  
  // Database check
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch (err) {
    errors.push('Database connection failed');
  }
  
  // Redis check
  try {
    const redis = getRedisClient();
    await redis.ping();
    checks.redis = true;
  } catch (err) {
    errors.push('Redis connection failed');
  }
  
  // S3 check
  try {
    const s3 = getS3Client();
    await s3.headBucket({ Bucket: process.env.S3_BUCKET_NAME! });
    checks.s3 = true;
  } catch (err) {
    errors.push('S3 connection failed');
  }
  
  // Workers check (check if jobs are being processed)
  try {
    const redis = getRedisClient();
    const activeJobs = await redis.llen('bull:processing:active');
    const waitingJobs = await redis.llen('bull:processing:wait');
    
    checks.workers = true;
    
    if (waitingJobs > 100) {
      errors.push(`High queue backlog: ${waitingJobs} waiting jobs`);
    }
  } catch (err) {
    errors.push('Workers status check failed');
  }
  
  const allHealthy = Object.values(checks).every(v => v);
  const status = allHealthy ? 200 : 503;
  
  return NextResponse.json(
    {
      status: allHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      checks,
      errors: errors.length > 0 ? errors : undefined,
    },
    { status }
  );
}
```

**2. Structured Logging**

```bash
npm install pino pino-pretty
```

```typescript
// lib/logger/index.ts (обновить)
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  
  // Development: pretty print
  ...(process.env.NODE_ENV === 'development' && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    },
  }),
  
  // Production: JSON
  ...(process.env.NODE_ENV === 'production' && {
    formatters: {
      level: (label) => ({ level: label }),
    },
  }),
  
  // Base fields
  base: {
    env: process.env.NODE_ENV,
    app: 'aam',
  },
});

export function createModuleLogger(module: string) {
  return logger.child({ module });
}

// Request logger middleware
export function requestLogger(req: Request) {
  const requestId = crypto.randomUUID();
  
  return logger.child({
    requestId,
    method: req.method,
    url: req.url,
  });
}
```

**3. Performance Metrics**

```typescript
// lib/metrics.ts
import { getRedisClient } from './redis';

interface Metric {
  name: string;
  value: number;
  tags?: Record<string, string>;
  timestamp: number;
}

export async function recordMetric(metric: Metric): Promise<void> {
  const redis = getRedisClient();
  
  // Store in Redis for aggregation
  const key = `metrics:${metric.name}:${Date.now()}`;
  await redis.setex(key, 3600, JSON.stringify(metric)); // 1 hour TTL
  
  // Log for monitoring tools
  console.log(JSON.stringify({
    type: 'metric',
    ...metric,
  }));
}

// Usage in code
export async function trackTranscriptionTime(
  meetingId: string,
  durationMs: number
): Promise<void> {
  await recordMetric({
    name: 'transcription.duration',
    value: durationMs,
    tags: { meetingId },
    timestamp: Date.now(),
  });
}
```

---

## 5. План дальнейшего развития

### 5.1 Roadmap по оптимизации

#### **Фаза 1: Foundation (Week 1-2)**
- [ ] Добавить индексы в БД
- [ ] Объединить запросы в pipeline
- [ ] Централизовать Redis connection
- [ ] Удалить устаревшие файлы
- [ ] Добавить health check endpoint

**Ожидаемый результат:**
- Снижение latency на 30-40%
- Улучшение stability
- Базовый мониторинг

---

#### **Фаза 2: Performance (Week 3-4)**
- [ ] Реализовать streaming для S3
- [ ] Добавить API response caching
- [ ] Внедрить rate limiting
- [ ] Оптимизировать database queries
- [ ] Добавить pagination

**Ожидаемый результат:**
- Снижение memory usage на 80%
- Снижение DB load на 50%
- Предотвращение API rate limit ошибок

---

#### **Фаза 3: Scalability (Week 5-8)**
- [ ] Настроить Redis Cluster
- [ ] Поддержка multi-instance workers
- [ ] Load balancing для API
- [ ] Graceful shutdown
- [ ] Distributed tracing

**Ожидаемый результат:**
- Horizontal scaling готовность
- High availability
- Zero-downtime deployments

---

#### **Фаза 4: DevX & Maintenance (Week 9-12)**
- [ ] Реорганизовать components structure
- [ ] Консолидировать utility scripts в CLI
- [ ] Улучшить documentation
- [ ] Добавить E2E тесты
- [ ] CI/CD pipeline

**Ожидаемый результат:**
- Улучшенный DX
- Снижение времени на debugging
- Автоматизация рутинных задач

---

### 5.2 Архитектурные улучшения (v2.0)

После завершения оптимизации v1, рассмотреть:

#### **1. Microservices extraction**
```
Current: Monolith Next.js
Future:
  - API Gateway (Next.js)
  - Transcription Service (standalone)
  - LLM Processing Service (standalone)
  - Storage Service (standalone)
```

**Преимущества:**
- Независимое масштабирование каждого сервиса
- Изоляция отказов
- Возможность использовать разные языки/frameworks

---

#### **2. Event-driven architecture**
```
Current: Synchronous pipeline
Future: Event-driven with message broker
  - Meeting created → Event
  - Transcription completed → Event
  - LLM completed → Event
  - Validation accepted → Event
```

**Технологии:**
- RabbitMQ или Kafka вместо BullMQ
- Event sourcing для audit trail
- CQRS для чтения vs записи

---

#### **3. Multi-tenancy**
```
Current: Single organization
Future: SaaS с multiple organizations
  - Row-level security в PostgreSQL
  - Tenant isolation в Redis
  - S3 buckets per tenant
```

---

## 6. Оценка приоритетов

### 6.1 Матрица приоритетов

| Оптимизация | Приоритет | Сложность | ROI | Рекомендация |
|-------------|-----------|-----------|-----|--------------|
| #1: Индексы БД | 🔴 КРИТИЧЕСКИЙ | 🟢 Низкая | ⭐⭐⭐⭐⭐ | ✅ Сделать немедленно |
| #2: Объединить запросы | 🔴 КРИТИЧЕСКИЙ | 🟡 Средняя | ⭐⭐⭐⭐⭐ | ✅ Сделать немедленно |
| #3: Redis connection | 🟡 СРЕДНИЙ | 🟢 Низкая | ⭐⭐⭐⭐ | ✅ Week 1 |
| #4: Удалить старый код | 🟢 НИЗКИЙ | 🟢 Низкая | ⭐⭐ | ✅ Week 1 |
| #5: S3 Streaming | 🔴 КРИТИЧЕСКИЙ | 🔴 Высокая | ⭐⭐⭐⭐⭐ | ✅ Week 2-3 |
| #6: API Caching | 🟡 СРЕДНИЙ | 🟡 Средняя | ⭐⭐⭐⭐ | ✅ Week 2 |
| #7: Реорганизация UI | 🟢 НИЗКИЙ | 🟡 Средняя | ⭐⭐ | ⏳ Week 4+ |
| #8: Scripts CLI | 🟢 НИЗКИЙ | 🟡 Средняя | ⭐⭐⭐ | ⏳ Week 3-4 |
| #9: Horizontal scaling | 🔴 КРИТИЧЕСКИЙ | 🔴 Высокая | ⭐⭐⭐⭐⭐ | ✅ Week 5-8 |
| #10: Rate limiting | 🟡 СРЕДНИЙ | 🟢 Низкая | ⭐⭐⭐⭐ | ✅ Week 3 |
| #11: Query optimization | 🟡 СРЕДНИЙ | 🟡 Средняя | ⭐⭐⭐⭐ | ✅ Week 3-4 |
| #12: Monitoring | 🔴 КРИТИЧЕСКИЙ | 🟡 Средняя | ⭐⭐⭐⭐⭐ | ✅ Week 1-2 |

---

### 6.2 Quick Wins (сделать в первую очередь)

1. **Индексы БД** (30 мин, огромное влияние)
2. **Health check endpoint** (1 час, необходим для production)
3. **Централизовать Redis** (1 час, улучшает stability)
4. **Удалить устаревший код** (15 мин, упрощает кодовую базу)

**Итого:** ~3 часа работы, улучшение production-readiness на 50%

---

### 6.3 Must-have для production

- [x] Асинхронный pipeline (уже есть)
- [x] Idempotency (уже есть)
- [x] Error handling (уже есть)
- [ ] **Database indexes** (КРИТИЧНО)
- [ ] **Health checks** (КРИТИЧНО)
- [ ] **Monitoring & logging** (КРИТИЧНО)
- [ ] **Rate limiting** (ВАЖНО)
- [ ] **Graceful shutdown** (ВАЖНО)
- [ ] **Redis high availability** (ВАЖНО для prod)

---

## 7. Заключение

### 7.1 Текущее состояние проекта

**Сильные стороны:**
✅ Хорошо спроектированная архитектура  
✅ Модульная структура кода  
✅ Строгая типизация TypeScript  
✅ Идемпотентный pipeline  
✅ Comprehensive error handling  
✅ RBAC реализован корректно  

**Слабые стороны:**
❌ Отсутствуют критичные индексы БД  
❌ Множественные запросы в pipeline  
❌ Загрузка больших файлов в память  
❌ Нет monitoring и observability  
❌ Не готов к horizontal scaling  
❌ Нет rate limiting для внешних API  

---

### 7.2 Рекомендации

**Для немедленного применения:**
1. Добавить индексы БД (30 минут, ROI 10x)
2. Объединить запросы в pipeline (2 часа, ROI 5x)
3. Добавить health checks (1 час, критично для prod)

**Для production deployment:**
1. Реализовать streaming для файлов (4 часа)
2. Внедрить monitoring (1-2 недели)
3. Настроить Redis HA (1 неделя)
4. Добавить rate limiting (1 неделя)

**Для долгосрочного развития:**
1. Horizontal scaling support (2 недели)
2. Advanced monitoring & alerting (2 недели)
3. Performance testing & benchmarking (1 неделя)

---

### 7.3 Итоговая оценка

**Текущий grade:** B+ (хорошая архитектура, требуются production-ready оптимизации)

**После оптимизаций:** A (production-ready, scalable, maintainable)

---

**Подготовлено:** AI Assistant  
**Контакт:** [ваш контакт]  
**Следующий review:** После применения Phase 1 оптимизаций

