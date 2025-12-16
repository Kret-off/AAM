/**
 * Centralized Logger
 * Provides consistent logging across the application
 */

import { LogLevel, LoggerConfig } from './config';
import { getLoggerConfig } from './config';

interface LogContext {
  [key: string]: unknown;
}

/**
 * Format log message with context
 */
function formatLogMessage(
  level: LogLevel,
  message: string,
  context?: LogContext
): string {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  
  if (context && Object.keys(context).length > 0) {
    return `${prefix} ${message} ${JSON.stringify(context)}`;
  }
  
  return `${prefix} ${message}`;
}

/**
 * Check if log level should be logged
 */
function shouldLog(level: LogLevel, config: LoggerConfig): boolean {
  const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
  const currentLevelIndex = levels.indexOf(config.level);
  const messageLevelIndex = levels.indexOf(level);
  
  return messageLevelIndex >= currentLevelIndex;
}

/**
 * Log debug message
 */
export function logDebug(message: string, context?: LogContext): void {
  const config = getLoggerConfig();
  
  if (!config.enabled || !shouldLog('debug', config)) {
    return;
  }
  
  console.log(formatLogMessage('debug', message, context));
}

/**
 * Log info message
 */
export function logInfo(message: string, context?: LogContext): void {
  const config = getLoggerConfig();
  
  if (!config.enabled || !shouldLog('info', config)) {
    return;
  }
  
  console.log(formatLogMessage('info', message, context));
}

/**
 * Log warning message
 */
export function logWarn(message: string, context?: LogContext): void {
  const config = getLoggerConfig();
  
  if (!config.enabled || !shouldLog('warn', config)) {
    return;
  }
  
  console.warn(formatLogMessage('warn', message, context));
}

/**
 * Log error message
 */
export function logError(
  message: string,
  error?: Error | unknown,
  context?: LogContext
): void {
  const config = getLoggerConfig();
  
  if (!config.enabled || !shouldLog('error', config)) {
    return;
  }
  
  const errorContext: LogContext = {
    ...context,
  };
  
  if (error instanceof Error) {
    errorContext.error = {
      message: error.message,
      name: error.name,
      stack: error.stack,
    };
  } else if (error) {
    errorContext.error = error;
  }
  
  console.error(formatLogMessage('error', message, errorContext));
}

/**
 * Create a logger with a specific module prefix
 */
export function createModuleLogger(moduleName: string) {
  return {
    debug: (message: string, context?: LogContext) =>
      logDebug(`[${moduleName}] ${message}`, context),
    info: (message: string, context?: LogContext) =>
      logInfo(`[${moduleName}] ${message}`, context),
    warn: (message: string, context?: LogContext) =>
      logWarn(`[${moduleName}] ${message}`, context),
    error: (message: string, error?: Error | unknown, context?: LogContext) =>
      logError(`[${moduleName}] ${message}`, error, context),
  };
}

