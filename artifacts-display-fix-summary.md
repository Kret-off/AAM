# Исправление отображения артефактов для сценария "Презентация КП"

## Проблема

При просмотре артефактов встречи, обработанной по сценарию "Презентация КП - Анализ и ОС", следующие секции отображались как сырой JSON текст без форматирования:

1. **Дополнительные потребности** (`additional_needs`)
2. **Презентация КП** (`kp_presentation`)
3. **Обратная связь по КП** (`client_feedback_on_kp`)
4. **Решение и позиция клиента** (`client_decision_and_position`)
5. **Следующие шаги** (`next_steps`)
6. **Оценка рисков** (`risk_assessment`)
7. **Оценка менеджера** (`sales_manager_assessment`)

### Причина проблемы

В компоненте `StructuredArtifactsView` (`components/meetings/meeting-detail/artifacts-viewer/structured-view.tsx`) не было специальных компонентов для отображения этих новых секций. В результате они попадали в `GenericSection`, который просто выводит JSON как текст через `JSON.stringify()` без форматирования и подсветки синтаксиса.

## Решение

Созданы специальные компоненты для каждой проблемной секции:

### 1. `additional-needs-section.tsx`
- Отображает дополнительные потребности в читаемом виде
- Показывает категории, обязательность, детали и доказательства
- Использует иконки и бейджи для визуального выделения

### 2. `kp-presentation-section.tsx`
- Отображает презентацию КП структурированно
- Показывает этапы проекта с описанием, стоимостью и сроками
- Выделяет общую стоимость, условия оплаты и бонусы

### 3. `client-feedback-kp-section.tsx`
- Отображает обратную связь клиента по категориям
- Показывает комментарии по стоимости, объему, срокам, функционалу
- Выделяет запрошенные изменения

### 4. `client-decision-position-section.tsx`
- Отображает позицию и решение клиента
- Показывает уровень интереса, отношение к бюджету, ЛПР
- Использует цветные бейджи для визуализации уровня интереса

### 5. `next-steps-section.tsx`
- Отображает следующие шаги структурированно
- Разделяет действия менеджера, клиента и рекомендации модели
- Использует разные иконки для каждого типа действий

### 6. `risk-assessment-section.tsx`
- Отображает оценку рисков
- Показывает вероятность сделки с цветовым кодированием
- Выделяет список рисков с иконками

### 7. `sales-manager-assessment-section.tsx`
- Отображает оценку работы менеджера
- Показывает оценку 0-10 с цветовым кодированием
- Разделяет сильные стороны и области для улучшения

## Изменения в коде

### Обновлен `structured-view.tsx`

1. **Добавлены импорты** новых компонентов:
```typescript
import { AdditionalNeedsSection } from './sections/additional-needs-section';
import { KPPresentationSection } from './sections/kp-presentation-section';
import { ClientFeedbackKPSection } from './sections/client-feedback-kp-section';
import { ClientDecisionPositionSection } from './sections/client-decision-position-section';
import { NextStepsSection } from './sections/next-steps-section';
import { RiskAssessmentSection } from './sections/risk-assessment-section';
import { SalesManagerAssessmentSection } from './sections/sales-manager-assessment-section';
```

2. **Обновлен маппинг секций** на компоненты:
```typescript
const sectionComponents: Record<string, React.ComponentType<{ data: unknown }>> = {
  // ... существующие секции
  additional_needs: AdditionalNeedsSection,
  kp_presentation: KPPresentationSection,
  client_feedback_on_kp: ClientFeedbackKPSection,
  client_decision_and_position: ClientDecisionPositionSection,
  next_steps: NextStepsSection,
  risk_assessment: RiskAssessmentSection,
  sales_manager_assessment: SalesManagerAssessmentSection,
  // ...
};
```

## Результат

Теперь все секции артефактов для сценария "Презентация КП" отображаются в читаемом структурированном виде с:
- ✅ Правильным форматированием
- ✅ Визуальным выделением важной информации
- ✅ Иконками и цветовым кодированием
- ✅ Удобной навигацией и группировкой данных
- ✅ Отображением доказательств (evidence) с цитатами

## Проверка

После применения изменений:
1. Откройте встречу, обработанную по сценарию "Презентация КП"
2. Перейдите в раздел "Артефакты"
3. Убедитесь, что все секции отображаются в читаемом виде, а не как сырой JSON

## Файлы изменений

### Новые файлы:
- `components/meetings/meeting-detail/artifacts-viewer/sections/additional-needs-section.tsx`
- `components/meetings/meeting-detail/artifacts-viewer/sections/kp-presentation-section.tsx`
- `components/meetings/meeting-detail/artifacts-viewer/sections/client-feedback-kp-section.tsx`
- `components/meetings/meeting-detail/artifacts-viewer/sections/client-decision-position-section.tsx`
- `components/meetings/meeting-detail/artifacts-viewer/sections/next-steps-section.tsx`
- `components/meetings/meeting-detail/artifacts-viewer/sections/risk-assessment-section.tsx`
- `components/meetings/meeting-detail/artifacts-viewer/sections/sales-manager-assessment-section.tsx`

### Измененные файлы:
- `components/meetings/meeting-detail/artifacts-viewer/structured-view.tsx`

## Примечания

- Все компоненты следуют единому стилю и используют существующие UI компоненты (`SectionCard`, `EvidenceBlock`, `Badge`)
- Компоненты обрабатывают случаи, когда данные отсутствуют или пусты
- Используется цветовое кодирование для визуального выделения важной информации
- Все компоненты типизированы и проверены линтером




