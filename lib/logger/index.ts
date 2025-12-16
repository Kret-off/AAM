/**
 * Logger module exports
 */

export {
  logDebug,
  logInfo,
  logWarn,
  logError,
  createModuleLogger,
} from './logger';

export {
  getLoggerConfig,
  setLoggerConfig,
  resetLoggerConfig,
  type LogLevel,
  type LoggerConfig,
} from './config';

// Export default logger instance for convenience
import { createModuleLogger } from './logger';
export const logger = createModuleLogger('APP');

