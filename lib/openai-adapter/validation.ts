/**
 * OpenAI Adapter Module Validation
 * JSON schema validation using AJV
 */

import Ajv from 'ajv';
import {
  OPENAI_ERROR_CODES,
  OPENAI_ERROR_MESSAGES,
} from './constants';
import { ValidatedLLMResponse } from './types';

const ajv = new Ajv({ allErrors: true, strict: false });

export interface ValidationResult {
  valid: boolean;
  data?: ValidatedLLMResponse;
  errors?: string[];
}

/**
 * Smart mapping for common enum value variations
 * Maps common variations to standard enum values
 */
function getSmartEnumMapping(value: string, allowedValues: string[]): string | null {
  const normalized = value.trim().toLowerCase();
  
  // Smart mappings for common variations
  const smartMappings: Record<string, string[]> = {
    // Category mappings
    'marketing': ['sales', 'other'],
    'маркетинг': ['sales', 'other'],
    'training': ['other', 'support'],
    'обучение': ['other', 'support'],
    'тренинг': ['other', 'support'],
    'development': ['production', 'other'],
    'разработка': ['production', 'other'],
    'dev': ['production', 'other'],
    'hr': ['management', 'other'],
    'hr-отдел': ['management', 'other'],
    'кадры': ['management', 'other'],
    'finance': ['management', 'analytics'],
    'финансы': ['management', 'analytics'],
    'accounting': ['management', 'analytics'],
    'бухгалтерия': ['management', 'analytics'],
    'legal': ['management', 'other'],
    'юридический': ['management', 'other'],
    'адвокат': ['management', 'other'],
  };
  
  // Check smart mappings first
  if (smartMappings[normalized]) {
    for (const candidate of smartMappings[normalized]) {
      if (allowedValues.includes(candidate)) {
        return candidate;
      }
    }
  }
  
  // Try fuzzy matching with common prefixes/suffixes
  for (const allowed of allowedValues) {
    const allowedLower = allowed.toLowerCase();
    
    // Check if value contains allowed or vice versa
    if (normalized.includes(allowedLower) || allowedLower.includes(normalized)) {
      return allowed;
    }
    
    // Check common variations
    if (
      (normalized === 'продажи' && allowedLower === 'sales') ||
      (normalized === 'сервис' && allowedLower === 'service') ||
      (normalized === 'производство' && allowedLower === 'production') ||
      (normalized === 'поддержка' && allowedLower === 'support') ||
      (normalized === 'управление' && allowedLower === 'management') ||
      (normalized === 'аналитика' && allowedLower === 'analytics') ||
      (normalized === 'интеграция' && allowedLower === 'integration') ||
      (normalized === 'другое' && allowedLower === 'other')
    ) {
      return allowed;
    }
  }
  
  return null;
}

/**
 * Normalize enum value: trim, lowercase, and try to match against allowed values
 * Returns normalized value or null if no match found
 */
function normalizeEnumValue(value: unknown, allowedValues: string[], fallbackToOther: boolean = true): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  
  const normalized = value.trim().toLowerCase();
  
  // Try exact match (case-insensitive)
  for (const allowed of allowedValues) {
    if (allowed.toLowerCase() === normalized) {
      return allowed; // Return original case from schema
    }
  }
  
  // Try partial match (remove spaces, underscores, etc.)
  const normalizedNoSpaces = normalized.replace(/[\s_-]/g, '');
  for (const allowed of allowedValues) {
    const allowedNormalized = allowed.toLowerCase().replace(/[\s_-]/g, '');
    if (allowedNormalized === normalizedNoSpaces) {
      return allowed;
    }
  }
  
  // Try smart mapping
  const smartMapped = getSmartEnumMapping(value, allowedValues);
  if (smartMapped) {
    return smartMapped;
  }
  
  // Fallback to "other" if available and fallbackToOther is true
  if (fallbackToOther && allowedValues.includes('other')) {
    return 'other';
  }
  
  return null;
}

/**
 * Extract enum values from schema at given path
 */
function getEnumValuesFromSchema(
  schema: unknown,
  path: string
): string[] | null {
  if (typeof schema !== 'object' || schema === null) {
    return null;
  }

  const schemaObj = schema as Record<string, unknown>;
  
  // Parse path like "/artifacts/gaps_for_regeneration/missing_data_items/5/linked_section"
  // or "/artifacts/tasks_and_requirements/8/category"
  const parts = path.split('/').filter(Boolean);
  
  if (parts.length === 0) {
    return null;
  }
  
  // Navigate through schema starting from root
  let current: unknown = schemaObj;
  
  // Handle full structure (with artifacts wrapper)
  // Path starts with "artifacts", so we need to navigate to artifacts.properties
  if (schemaObj.properties && typeof schemaObj.properties === 'object') {
    const properties = schemaObj.properties as Record<string, unknown>;
    if (properties.artifacts && typeof properties.artifacts === 'object') {
      const artifacts = properties.artifacts as Record<string, unknown>;
      // Navigate to artifacts.properties
      if (artifacts.properties && typeof artifacts.properties === 'object') {
        current = artifacts.properties;
      } else {
        current = artifacts;
      }
    } else {
      // No artifacts wrapper, start from properties
      current = properties;
    }
  }
  
  // Skip "artifacts" part if present (we're already in artifacts.properties)
  let startIndex = parts[0] === 'artifacts' ? 1 : 0;
  
  // Navigate through path parts
  for (let i = startIndex; i < parts.length; i++) {
    const part = parts[i];
    
    if (typeof current !== 'object' || current === null) {
      return null;
    }
    
    const currentObj = current as Record<string, unknown>;
    
    // If we're at an array index (numeric part), navigate to items
    if (/^\d+$/.test(part)) {
      // Current should be an array schema, navigate to items
      if (currentObj.items && typeof currentObj.items === 'object') {
        current = currentObj.items;
        // If items is an object schema, navigate to its properties
        if (typeof current === 'object' && current !== null) {
          const itemsObj = current as Record<string, unknown>;
          if (itemsObj.properties && typeof itemsObj.properties === 'object') {
            current = itemsObj.properties;
          }
        }
        continue;
      }
      return null;
    }
    
    // Navigate to property
    if (currentObj.properties && typeof currentObj.properties === 'object') {
      const props = currentObj.properties as Record<string, unknown>;
      if (props[part]) {
        current = props[part];
        // If property is an array, prepare for next iteration
        const propObj = current as Record<string, unknown>;
        if (propObj.type === 'array' && propObj.items) {
          // Don't navigate yet, wait for index
          continue;
        }
        continue;
      }
    }
    
    // Try direct property access (for nested objects)
    if (part in currentObj) {
      current = currentObj[part];
      continue;
    }
    
    return null;
  }
  
  // Extract enum from current schema node
  if (typeof current === 'object' && current !== null) {
    const currentObj = current as Record<string, unknown>;
    if (Array.isArray(currentObj.enum)) {
      return currentObj.enum as string[];
    }
  }
  
  return null;
}

/**
 * Build detailed error message with enum values if available
 */
export function buildDetailedValidationErrors(
  errors: string[],
  schema: unknown
): string[] {
  return errors.map((error) => {
    // Check if error is about enum
    if (error.includes('must be equal to one of the allowed values')) {
      // Extract path from error (format: "/path/to/field: message")
      const pathMatch = error.match(/^([^:]+):/);
      if (pathMatch) {
        const path = pathMatch[1];
        const enumValues = getEnumValuesFromSchema(schema, path);
        if (enumValues && enumValues.length > 0) {
          return `${error} Allowed values: ${enumValues.join(', ')}`;
        }
      }
    }
    return error;
  });
}

/**
 * Find all enum fields in schema recursively and return their paths
 * Returns paths in format: "artifacts.tasks_and_requirements[].category"
 */
function findAllEnumPaths(
  schema: unknown,
  path: string = '',
  result: Array<{ path: string; values: string[] }> = []
): Array<{ path: string; values: string[] }> {
  if (typeof schema !== 'object' || schema === null) {
    return result;
  }

  const schemaObj = schema as Record<string, unknown>;

  // Check if this field has enum values
  if (Array.isArray(schemaObj.enum)) {
    const enumValues = schemaObj.enum.filter(
      (v): v is string => typeof v === 'string'
    );
    if (enumValues.length > 0 && path) {
      result.push({ path, values: enumValues });
    }
  }

  // Recursively process properties
  if (schemaObj.properties && typeof schemaObj.properties === 'object') {
    const properties = schemaObj.properties as Record<string, unknown>;
    for (const [key, value] of Object.entries(properties)) {
      const newPath = path ? `${path}.${key}` : key;
      findAllEnumPaths(value, newPath, result);
    }
  }

  // Handle array items
  if (schemaObj.type === 'array' && schemaObj.items) {
    const items = schemaObj.items;
    if (typeof items === 'object' && items !== null) {
      const arrayPath = path ? `${path}[]` : '[]';
      findAllEnumPaths(items, arrayPath, result);
    }
  }

  return result;
}


/**
 * Automatically normalize all enum values in response BEFORE validation
 * This implements "soft validation" - accept any value and normalize it
 */
function normalizeAllEnumValues(
  response: unknown,
  schema: unknown
): { normalized: boolean; normalizedCount: number } {
  if (typeof response !== 'object' || response === null) {
    return { normalized: false, normalizedCount: 0 };
  }

  // Find all enum paths in schema
  const enumPaths = findAllEnumPaths(schema);
  
  if (enumPaths.length === 0) {
    return { normalized: false, normalizedCount: 0 };
  }

  const stats = { normalizedCount: 0 };
  
  // For each enum path, find and normalize values in response
  for (const { path, values } of enumPaths) {
    // Parse path like "artifacts.tasks_and_requirements[].category"
    const pathParts = path.split('.');
    
    // Navigate to the field in response
    let current: unknown = response;
    let found = true;
    
    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      
      if (typeof current !== 'object' || current === null) {
        found = false;
        break;
      }
      
      // Handle array notation
      if (part.endsWith('[]')) {
        const arrayKey = part.slice(0, -2);
        if (typeof current === 'object' && !Array.isArray(current)) {
          current = (current as Record<string, unknown>)[arrayKey];
        }
        
        // If current is an array, process each item
        if (Array.isArray(current)) {
          const remainingPath = pathParts.slice(i + 1).join('.');
          for (let idx = 0; idx < current.length; idx++) {
            const item = current[idx];
            if (typeof item === 'object' && item !== null) {
              // Navigate to the enum field in this item
              let itemCurrent: unknown = item;
              for (const remainingPart of pathParts.slice(i + 1)) {
                if (typeof itemCurrent !== 'object' || itemCurrent === null) {
                  break;
                }
                itemCurrent = (itemCurrent as Record<string, unknown>)[remainingPart];
              }
              
              // Normalize if it's a string
              if (typeof itemCurrent === 'string') {
                const originalValue = itemCurrent;
                const normalized = normalizeEnumValue(originalValue, values, true);
                
                if (normalized !== null && normalized !== originalValue) {
                  // Update the value - navigate to parent in the item
                  let itemParent: unknown = item;
                  for (let j = 0; j < pathParts.slice(i + 1).length - 1; j++) {
                    const partName = pathParts[i + 1 + j];
                    if (typeof itemParent === 'object' && itemParent !== null && !Array.isArray(itemParent)) {
                      itemParent = (itemParent as Record<string, unknown>)[partName];
                    }
                  }
                  
                  const fieldName = pathParts[pathParts.length - 1];
                  if (typeof itemParent === 'object' && itemParent !== null && !Array.isArray(itemParent)) {
                    (itemParent as Record<string, unknown>)[fieldName] = normalized;
                    stats.normalizedCount++;
                    console.log(`[Enum Normalization] ${path} [${idx}]: "${originalValue}" -> "${normalized}"`);
                  }
                }
              }
            }
          }
          found = false; // Already processed
          break;
        }
      } else {
        // Navigate to property
        if (typeof current === 'object' && !Array.isArray(current)) {
          current = (current as Record<string, unknown>)[part];
        } else {
          found = false;
          break;
        }
      }
    }
    
    // If we found the field and it's a string, normalize it
    if (found && typeof current === 'string') {
      const originalValue = current;
      const normalized = normalizeEnumValue(originalValue, values, true);
      
      if (normalized !== null && normalized !== originalValue) {
        // Update the value - need to navigate to parent
        let parent: unknown = response;
        for (let i = 0; i < pathParts.length - 1; i++) {
          const part = pathParts[i];
          if (typeof parent === 'object' && parent !== null && !Array.isArray(parent)) {
            parent = (parent as Record<string, unknown>)[part];
          }
        }
        
        const fieldName = pathParts[pathParts.length - 1];
        if (typeof parent === 'object' && parent !== null && !Array.isArray(parent)) {
          (parent as Record<string, unknown>)[fieldName] = normalized;
          stats.normalizedCount++;
          console.log(`[Enum Normalization] ${path}: "${originalValue}" -> "${normalized}"`);
        }
      }
    }
  }

  return {
    normalized: stats.normalizedCount > 0,
    normalizedCount: stats.normalizedCount,
  };
}

/**
 * Normalize enum values in response for specific error paths (legacy function, kept for backward compatibility)
 */
function normalizeEnumValuesForErrors(
  response: unknown,
  schema: unknown,
  errorPaths: string[]
): void {
  if (typeof response !== 'object' || response === null) {
    return;
  }

  for (const errorPath of errorPaths) {
    // Extract enum values for this path
    const enumValues = getEnumValuesFromSchema(schema, errorPath);
    if (!enumValues || enumValues.length === 0) {
      continue;
    }

    // Get current value at path
    const parts = errorPath.split('/').filter(Boolean);
    let current: unknown = response;
    let parent: Record<string, unknown> | unknown[] | null = null;
    let lastKey: string | number | null = null;

    // Navigate to the value
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      parent = current as Record<string, unknown> | unknown[] | null;
      
      if (typeof current !== 'object' || current === null) {
        break;
      }

      if (Array.isArray(current)) {
        const index = parseInt(part, 10);
        if (isNaN(index)) break;
        current = current[index];
        lastKey = index;
      } else {
        current = (current as Record<string, unknown>)[part];
        lastKey = part;
      }
    }

    // Try to normalize the value (with fallback to "other")
    if (parent !== null && lastKey !== null && typeof current === 'string') {
      const normalized = normalizeEnumValue(current, enumValues, true); // fallback to "other"
      if (normalized !== null && normalized !== current) {
        if (Array.isArray(parent)) {
          parent[lastKey as number] = normalized;
        } else {
          (parent as Record<string, unknown>)[lastKey as string] = normalized;
        }
        
        console.log(`[Enum Normalization] ${errorPath}: "${current}" -> "${normalized}"`);
      }
    }
  }
}

/**
 * Validate LLM response against output schema
 * Uses outputSchema directly without hardcoded wrapper structure
 * Implements "soft validation" for enum: normalizes enum values BEFORE validation
 */
export function validateLLMResponse(
  response: unknown,
  outputSchema: unknown
): ValidationResult {
  // First, check if response is an object
  if (typeof response !== 'object' || response === null) {
    return {
      valid: false,
      errors: ['Response must be a JSON object'],
    };
  }

  // Check if outputSchema is valid
  if (typeof outputSchema !== 'object' || outputSchema === null) {
    return {
      valid: false,
      errors: ['Output schema must be a valid JSON schema object'],
    };
  }

  // Deep clone response to avoid mutating original
  const responseCopy = JSON.parse(JSON.stringify(response));

  // Use outputSchema directly - it defines the complete structure
  const schemaObj = outputSchema as Record<string, unknown>;
  
  // Ensure schema has type: 'object'
  const fullSchema: Record<string, unknown> = {
    type: 'object',
    ...schemaObj,
  };

  // 🔥 KEY CHANGE: Normalize ALL enum values BEFORE validation
  // This implements "soft validation" - accept any value and normalize it
  const normalizationResult = normalizeAllEnumValues(responseCopy, fullSchema);
  if (normalizationResult.normalized) {
    console.log(`[Enum Normalization] Normalized ${normalizationResult.normalizedCount} enum value(s) before validation`);
  }

  // Validate response against schema
  const validate = ajv.compile(fullSchema);
  let isValid = validate(responseCopy);
  
  // If validation still failed with enum errors (shouldn't happen after normalization, but keep as fallback)
  if (!isValid) {
    const enumErrorPaths = validate.errors
      ?.filter((err) => err.message?.includes('must be equal to one of the allowed values'))
      .map((err) => err.instancePath || '')
      .filter(Boolean) || [];
    
    if (enumErrorPaths.length > 0) {
      // Try to normalize enum values (fallback)
      normalizeEnumValuesForErrors(responseCopy, fullSchema, enumErrorPaths);
      
      // Re-validate after normalization
      isValid = validate(responseCopy);
    }
  }

  if (!isValid) {
    const errors = validate.errors?.map((err) => {
      const path = err.instancePath || err.schemaPath;
      return `${path}: ${err.message}`;
    }) || ['Schema validation failed'];

    // Build detailed errors with enum values
    const detailedErrors = buildDetailedValidationErrors(errors, fullSchema);

    return {
      valid: false,
      errors: detailedErrors,
    };
  }

  // Return validated normalized response (structure defined by outputSchema)
  return {
    valid: true,
    data: responseCopy as ValidatedLLMResponse,
  };
}

/**
 * Attempt to extract JSON from response text
 * Handles cases where LLM returns markdown code blocks or extra text
 */
export function extractJSONFromResponse(responseText: string): unknown | null {
  try {
    // Try to parse as-is first
    return JSON.parse(responseText);
  } catch {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch {
        // Continue to next attempt
      }
    }

    // Try to find JSON object in text
    const objectMatch = responseText.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]);
      } catch {
        // Continue to next attempt
      }
    }

    return null;
  }
}

