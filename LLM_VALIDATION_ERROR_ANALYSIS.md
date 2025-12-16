# Анализ ошибки валидации LLM для встречи 5bdbe684-0f05-401e-a278-09b99ad3c350

## Дата анализа
2025-12-08

## Резюме проблемы

Встреча `5bdbe684-0f05-401e-a278-09b99ad3c350` успешно прошла транскрибацию, но на этапе обработки LLM возникла ошибка:
- **Ошибка**: `Response does not match output schema`
- **Код ошибки**: `SCHEMA_VALIDATION_FAILED`
- **Статус встречи**: `Failed_LLM`

## Детальный анализ

### 1. Данные из БД

#### LLM Interactions
- **Всего попыток**: 2
- **Первая попытка** (attempt #1):
  - ID: `22bf9057-7169-4598-be62-09e4b0ed3faa`
  - Is Repair Attempt: `false`
  - Is Final: `false`
  - Is Valid: `null` (не валидировалась)
  - Token Usage: 35,100 tokens (30,042 prompt + 5,058 completion)
  - Finish Reason: `stop`
  - Raw Response: 20,130 символов
  - **Содержит**: `artifacts` и `quality` ✅

- **Repair попытка** (attempt #2):
  - ID: `4ec76e4e-cb8b-4085-be85-f49369da1b73`
  - Is Repair Attempt: `true`
  - Is Final: `false`
  - Is Valid: `null` (не валидировалась)
  - Token Usage: 35,143 tokens (30,085 prompt + 5,058 completion)
  - Finish Reason: `stop`
  - Raw Response: 19,666 символов
  - **Содержит**: `artifacts` и `quality` ✅

#### Processing Error
- **Stage**: `llm`
- **Error Code**: `SCHEMA_VALIDATION_FAILED`
- **Error Message**: `Response does not match output schema`
- **Validation Errors**:
  ```
  /artifacts: must have required property 'artifacts'
  /artifacts: must have required property 'quality'
  ```

### 2. Корневая причина

#### Проблема в логике валидации

Функция `validateLLMResponse` в `lib/openai-adapter/validation.ts` неправильно обрабатывала `outputSchema` из БД.

**Что было в БД:**
```json
{
  "type": "object",
  "required": ["artifacts", "quality"],
  "properties": {
    "artifacts": { "type": "object", "properties": {} },
    "quality": { ... }
  }
}
```

**Что делал код:**
```typescript
// Неправильно: использовал outputSchema как схему для artifacts
properties: {
  artifacts: outputSchema,  // ❌ Это создавало вложенную структуру
  quality: { ... }
}
```

**Результат:**
AJV ожидал структуру:
```json
{
  "artifacts": {
    "artifacts": { ... },  // ❌ Неправильно
    "quality": { ... }     // ❌ Неправильно
  },
  "quality": { ... }
}
```

**Что возвращал LLM:**
```json
{
  "artifacts": {
    "meeting_summary": { ... }  // ✅ Правильно
  },
  "quality": { ... }            // ✅ Правильно
}
```

### 3. Дополнительные проблемы

1. **Использование несуществующей константы**:
   - В `lib/openai-adapter/service.ts:438` использовалась `OPENAI_CONSTANTS.MAX_TOKENS`
   - Правильная константа: `OPENAI_CONSTANTS.MAX_COMPLETION_TOKENS`

2. **Несохранение результатов валидации**:
   - При неудачной валидации repair attempt не сохраняется информация о валидации
   - Поля `isValid` и `validationErrors` остаются `null`

## Решение

### Исправление 1: Логика валидации

Обновлена функция `validateLLMResponse` для правильной обработки `outputSchema`:

```typescript
// Проверяем, содержит ли outputSchema полную структуру
const hasFullStructure = outputSchemaObj &&
  typeof outputSchemaObj.properties === 'object' &&
  outputSchemaObj.properties !== null &&
  'artifacts' in (outputSchemaObj.properties as Record<string, unknown>) &&
  'quality' in (outputSchemaObj.properties as Record<string, unknown>);

// Используем outputSchema как есть, если он уже содержит полную структуру
const fullSchema = hasFullStructure
  ? outputSchemaObj
  : {
      // Иначе оборачиваем outputSchema в структуру с artifacts и quality
      type: 'object',
      required: ['artifacts', 'quality'],
      properties: {
        artifacts: outputSchemaObj || { type: 'object' },
        quality: { ... }
      }
    };
```

### Исправление 2: Константа

Исправлено использование константы:
```typescript
// Было:
maxTokens: OPENAI_CONSTANTS.MAX_TOKENS,

// Стало:
maxTokens: OPENAI_CONSTANTS.MAX_COMPLETION_TOKENS,
```

## Результаты после исправления

После исправления валидация проходит успешно для обоих ответов LLM:
- ✅ Первая попытка: Validation PASSED
- ✅ Repair попытка: Validation PASSED

## Рекомендации

1. **Обновить существующие сценарии**:
   - Рассмотреть возможность миграции `outputSchema` в БД к правильному формату
   - `outputSchema` должен описывать только структуру `artifacts`, без обертки

2. **Улучшить сохранение результатов валидации**:
   - Сохранять `isValid: false` и `validationErrors` при неудачной валидации
   - Это поможет в диагностике будущих проблем

3. **Добавить тесты**:
   - Тесты для валидации с полной структурой `outputSchema`
   - Тесты для валидации с только схемой `artifacts`

## Файлы изменены

1. `lib/openai-adapter/validation.ts` - исправлена логика валидации
2. `lib/openai-adapter/service.ts` - исправлена константа

## Скрипт для анализа

Создан скрипт `scripts/analyze-llm-validation-error.ts` для диагностики подобных проблем в будущем.

## Статус

✅ **Проблема решена**

Валидация теперь правильно обрабатывает оба формата `outputSchema`:
- Полная структура (legacy формат из seed.ts)
- Только схема для artifacts (правильный формат)








