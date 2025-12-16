/**
 * Logger Configuration
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LoggerConfig {
  /**
   * Enable/disable logging
   */
  enabled: boolean;
  
  /**
   * Minimum log level to display
   */
  level: LogLevel;
  
  /**
   * Pretty print JSON context
   */
  prettyPrint: boolean;
}

/**
 * Default logger configuration
 */
const defaultConfig: LoggerConfig = {
  enabled: true,
  level: (process.env.LOG_LEVEL as LogLevel) || 'info',
  prettyPrint: process.env.NODE_ENV === 'development',
};

let currentConfig: LoggerConfig = { ...defaultConfig };

/**
 * Get current logger configuration
 */
export function getLoggerConfig(): LoggerConfig {
  return currentConfig;
}

/**
 * Update logger configuration
 */
export function setLoggerConfig(config: Partial<LoggerConfig>): void {
  currentConfig = {
    ...currentConfig,
    ...config,
  };
}

/**
 * Reset logger configuration to defaults
 */
export function resetLoggerConfig(): void {
  currentConfig = { ...defaultConfig };
}

