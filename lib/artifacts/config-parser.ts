/**
 * Artifacts Config Parser
 * Utilities for parsing and working with artifactsConfig
 */

import { ArtifactsConfig, ArtifactsConfigSection } from './types';

/**
 * Default artifacts configuration with all sections
 */
export function getDefaultArtifactsConfig(): ArtifactsConfig {
  return {
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
}

/**
 * Parse artifactsConfig from unknown type
 */
export function parseArtifactsConfig(config: unknown): ArtifactsConfig {
  // If config is null or undefined, return default
  if (config === null || config === undefined) {
    return getDefaultArtifactsConfig();
  }

  // Check if it's an object
  if (typeof config !== 'object') {
    return getDefaultArtifactsConfig();
  }

  const configObj = config as Record<string, unknown>;

  // Check if it has sections array
  if (!Array.isArray(configObj.sections)) {
    return getDefaultArtifactsConfig();
  }

  // Validate and parse sections
  const sections: ArtifactsConfigSection[] = [];
  for (const section of configObj.sections) {
    if (typeof section !== 'object' || section === null) {
      continue;
    }

    const sectionObj = section as Record<string, unknown>;

    // Validate required fields
    if (
      typeof sectionObj.key !== 'string' ||
      typeof sectionObj.label !== 'string' ||
      typeof sectionObj.order !== 'number' ||
      typeof sectionObj.visible !== 'boolean'
    ) {
      continue;
    }

    sections.push({
      key: sectionObj.key,
      label: sectionObj.label,
      order: sectionObj.order,
      visible: sectionObj.visible,
    });
  }

  // If no valid sections found, return default
  if (sections.length === 0) {
    return getDefaultArtifactsConfig();
  }

  return { sections };
}

/**
 * Get visible sections sorted by order
 */
export function getVisibleSections(config: ArtifactsConfig): ArtifactsConfigSection[] {
  return config.sections
    .filter((section) => section.visible)
    .sort((a, b) => a.order - b.order);
}

/**
 * Get section by key
 */
export function getSectionByKey(
  config: ArtifactsConfig,
  key: string
): ArtifactsConfigSection | undefined {
  return config.sections.find((section) => section.key === key);
}







