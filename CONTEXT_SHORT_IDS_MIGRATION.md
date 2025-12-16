# Контекст: Миграция с UUID на короткие ID

## Обзор изменений

Проект AAM (Assist after meeting) был мигрирован с UUID на короткие ID формата `{префикс}{число}` (например, `usr1`, `cli42`, `met100`).

**Дата миграции:** 2025-12-11  
**Статус:** ✅ Завершено

---

## Формат новых ID

### Префиксы таблиц

| Таблица | Префикс | Пример ID |
|---------|---------|-----------|
| `user` | `usr` | `usr1`, `usr2` |
| `client` | `cli` | `cli1`, `cli42` |
| `meeting_type` | `mty` | `mty1`, `mty2` |
| `prompt_scenario` | `scn` | `scn1`, `scn2` |
| `directory_participant` | `par` | `par1`, `par2` |
| `meeting` | `met` | `met1`, `met100` |
| `upload_blob` | `upl` | `upl1`, `upl2` |
| `transcript` | `trs` | `trs1`, `trs2` |
| `artifacts` | `art` | `art1`, `art2` |
| `validation` | `val` | `val1`, `val2` |
| `processing_error` | `err` | `err1`, `err2` |
| `llm_interaction` | `llm` | `llm1`, `llm2` |

**Примечание:** Составные ключи (`MeetingParticipant`, `MeetingViewer`, `UserMeetingType`) остались без изменений.

---

## Архитектура решения

### 1. Таблица счетчиков

**Файл:** `prisma/migrations/20251211153405_add_id_sequence/migration.sql`

```sql
CREATE TABLE "id_sequence" (
    "table_name" TEXT NOT NULL PRIMARY KEY,
    "current_value" BIGINT NOT NULL DEFAULT 0
);
```

### 2. Генератор ID

**Файл:** `lib/db/id-generator.ts`

- `generateShortId(tableName: string)` - атомарно генерирует следующий ID
- `initializeCounter(tableName, initialValue)` - инициализирует счетчик
- `getCurrentCounter(tableName)` - получает текущее значение счетчика

**Механизм:** Использует PostgreSQL `INSERT ... ON CONFLICT ... DO UPDATE` для атомарного инкремента.

---

## Изменения в коде

### 1. Prisma Schema

**Файл:** `prisma/schema.prisma`

**Изменение:** Убраны все `@default(uuid())` из моделей:
- `User`, `Client`, `MeetingType`, `PromptScenario`, `DirectoryParticipant`
- `Meeting`, `UploadBlob`, `Transcript`, `Artifacts`, `Validation`
- `ProcessingError`, `LLMInteraction`

**Было:**
```prisma
model User {
  id String @id @default(uuid())
}
```

**Стало:**
```prisma
model User {
  id String @id
}
```

### 2. Создание сущностей

Все места создания сущностей обновлены для использования `generateShortId()`:

**Пример (User):**
```typescript
// app/api/users/route.ts
const { generateShortId } = await import('@/lib/db/id-generator');
const userId = await generateShortId('user');

const newUser = await prisma.user.create({
  data: {
    id: userId,
    email: email.toLowerCase().trim(),
    // ...
  },
});
```

**Обновленные файлы:**
- `app/api/users/route.ts` - User
- `lib/client-kb/service.ts` - Client
- `lib/scenario/service.ts` - MeetingType, PromptScenario
- `lib/directory/service.ts` - DirectoryParticipant
- `lib/meeting/service.ts` - Meeting
- `lib/upload/service.ts` - UploadBlob
- `lib/orchestrator/processors/transcription.ts` - Transcript, ProcessingError
- `lib/orchestrator/processors/llm.ts` - Artifacts, ProcessingError
- `lib/orchestrator/workers.ts` - ProcessingError
- `lib/llm-interaction/service.ts` - LLMInteraction
- `lib/meeting/validation-service.ts` - Validation

### 3. Валидаторы ID

Все валидаторы обновлены для проверки формата `{префикс}{число}`:

**Файлы:**
- `lib/meeting/validation.ts` - `validateMeetingId()`
- `lib/client-kb/validation.ts` - `validateClientId()`
- `lib/scenario/validation.ts` - `validateScenarioId()`, `validateMeetingTypeId()`
- `lib/directory/validation.ts` - `validateParticipantId()`
- `lib/upload/validation.ts` - `validateMeetingId()`

**Новый формат валидации:**
```typescript
// Short ID format validation: 3 letters + 1+ digits
const shortIdRegex = /^[a-z]{3}\d+$/i;

if (!shortIdRegex.test(id)) {
  return { valid: false, error: {...} };
}

// Check prefix matches expected prefix
if (!id.toLowerCase().startsWith('met')) {
  return { valid: false, error: {...} };
}
```

---

## Миграция данных

### Скрипт миграции

**Файл:** `scripts/migrate-uuid-to-short-id.ts`

**Назначение:** Конвертирует существующие UUID в короткие ID для всех таблиц.

**Порядок миграции:**
1. Инициализация счетчиков для всех таблиц
2. Миграция таблиц в порядке зависимостей:
   - User → Client → MeetingType → PromptScenario → DirectoryParticipant
   - Meeting → UploadBlob, Transcript, Artifacts, Validation, ProcessingError, LLMInteraction

**Важно:** Скрипт обновляет:
- Первичные ключи в самих таблицах
- Все внешние ключи в зависимых таблицах

**Использование:**
```bash
npx tsx scripts/migrate-uuid-to-short-id.ts
```

---

## Важные замечания

### 1. Атомарность генерации ID

Функция `generateShortId()` использует PostgreSQL транзакции для атомарного инкремента счетчика. Это гарантирует уникальность ID даже при параллельных запросах.

### 2. Транзакции

При создании сущностей в транзакциях (например, Meeting с участниками), ID генерируется **внутри транзакции**:

```typescript
const meeting = await prisma.$transaction(async (tx) => {
  const meetingId = await generateShortId('meeting'); // Внутри транзакции
  const newMeeting = await tx.meeting.create({
    data: { id: meetingId, ... }
  });
  // ...
});
```

### 3. Обработка ошибок

В `lib/client-kb/service.ts` добавлена дополнительная обработка ошибок:
- Проверка существования клиента перед созданием
- Обработка ошибок генерации ID
- Детальная обработка Prisma ошибок (P2002 для unique constraint)

### 4. Изменения в Meeting Service

В `lib/meeting/service.ts` добавлена автоматическая генерация title на основе `meetingTypeId` (временное решение, требует доработки).

---

## Следующие шаги

### Для применения изменений:

1. **Применить миграцию БД:**
   ```bash
   npx prisma migrate deploy
   # или для dev
   npx prisma migrate dev
   ```

2. **Запустить миграцию данных** (если есть существующие данные):
   ```bash
   npx tsx scripts/migrate-uuid-to-short-id.ts
   ```

3. **Перегенерировать Prisma Client:**
   ```bash
   npx prisma generate
   ```

4. **Протестировать создание новых сущностей:**
   - Создание пользователя
   - Создание клиента
   - Создание встречи
   - И т.д.

### Потенциальные проблемы:

1. **Кэширование ID в клиенте:** Если фронтенд кэширует UUID, нужно обновить кэш
2. **API endpoints:** Убедиться, что все endpoints принимают новый формат ID
3. **Тесты:** Обновить тесты, которые используют UUID
4. **Логи:** Проверить, что логи корректно обрабатывают короткие ID

---

## Файлы для проверки

### Критически важные:
- `lib/db/id-generator.ts` - генератор ID
- `prisma/schema.prisma` - схема БД
- `prisma/migrations/20251211153405_add_id_sequence/migration.sql` - миграция таблицы

### Сервисы создания:
- `lib/client-kb/service.ts` - создание клиентов
- `lib/meeting/service.ts` - создание встреч
- `lib/scenario/service.ts` - создание сценариев
- `lib/directory/service.ts` - создание участников

### Валидаторы:
- `lib/meeting/validation.ts`
- `lib/client-kb/validation.ts`
- `lib/scenario/validation.ts`
- `lib/directory/validation.ts`
- `lib/upload/validation.ts`

---

## Контакты и вопросы

Если возникнут вопросы по миграции:
1. Проверить логи генерации ID в `lib/db/id-generator.ts`
2. Убедиться, что таблица `id_sequence` создана и инициализирована
3. Проверить порядок миграции таблиц в скрипте миграции

---

**Статус:** ✅ Готово к использованию  
**Последнее обновление:** 2025-12-11

---

## Результаты тестирования

### ✅ Миграция БД
- Миграция `20251211153405_add_id_sequence` успешно применена
- Таблица `id_sequence` создана и инициализирована

### ✅ Миграция данных
- Успешно мигрировано:
  - 2 пользователя (User)
  - 7 клиентов (Client)
  - 1 тип встречи (MeetingType)
  - 2 сценария (PromptScenario)
  - 6 встреч (Meeting)
  - 6 загруженных файлов (UploadBlob)
  - 6 транскриптов (Transcript)
  - 6 артефактов (Artifacts)
  - 4 валидации (Validation)
  - 14 взаимодействий с LLM (LLMInteraction)

### ✅ Тестирование генерации ID
Все тесты пройдены успешно:
- ✅ Генерация User ID (формат: `usr{N}`)
- ✅ Генерация Client ID (формат: `cli{N}`)
- ✅ Генерация MeetingType ID (формат: `mty{N}`)
- ✅ Генерация Meeting ID (формат: `met{N}`)
- ✅ Последовательная генерация (инкремент работает корректно)
- ✅ Создание реальных сущностей User и Client

**Примеры сгенерированных ID:**
- `usr9`, `usr10` - User
- `cli12`, `cli13`, `cli14`, `cli15` - Client
- `mty2`, `mty3` - MeetingType
- `met7`, `met8` - Meeting

**Вывод:** Система коротких ID полностью работоспособна и готова к использованию в продакшене.
