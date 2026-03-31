/**
 * Development-only logging utility
 * Replaces console.log/error/warn statements for production
 *
 * Usage:
 * import { logger } from '@/utils/logger';
 * logger.log('Debug info', data); // Only shows in development
 * logger.error('Error occurred', error); // Shows in development, can be configured for production errors
 * logger.warn('Warning message'); // Only shows in development
 */

type LogLevel = 'log' | 'error' | 'warn' | 'info' | 'debug';

interface LoggerConfig {
  enableInProduction: boolean;
  logLevels: {
    error: boolean;
    warn: boolean;
    info: boolean;
    log: boolean;
    debug: boolean;
  };
}

const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';

// Default configuration - only errors in production, all logs in development
const config: LoggerConfig = {
  enableInProduction: true, // Set to true if you want some logs in production
  logLevels: {
    error: isDevelopment ? true : true, // Always show errors
    warn: isDevelopment ? true : true,
    info: isDevelopment ? true : true,
    log: isDevelopment ? true : true,
    debug: isDevelopment ? true : true,
  }
};

class Logger {
  private shouldLog(level: LogLevel): boolean {
    if (isDevelopment) {
      return config.logLevels[level];
    }
    return config.enableInProduction && config.logLevels[level];
  }

  private formatMessage(level: LogLevel, ...args: any[]): void {
    if (!this.shouldLog(level)) return;

    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

    switch (level) {
      case 'error':
        console.error(prefix, ...args);
        break;
      case 'warn':
        console.warn(prefix, ...args);
        break;
      case 'info':
        console.info(prefix, ...args);
        break;
      case 'debug':
        console.debug(prefix, ...args);
        break;
      default:
        console.log(prefix, ...args);
    }
  }

  log(...args: any[]): void {
    this.formatMessage('log', ...args);
  }

  error(...args: any[]): void {
    this.formatMessage('error', ...args);
  }

  warn(...args: any[]): void {
    this.formatMessage('warn', ...args);
  }

  info(...args: any[]): void {
    this.formatMessage('info', ...args);
  }

  debug(...args: any[]): void {
    this.formatMessage('debug', ...args);
  }

  // Group logging for better organization
  group(label: string): void {
    if (this.shouldLog('log')) {
      console.group(`[${new Date().toISOString()}] ${label}`);
    }
  }

  groupEnd(): void {
    if (this.shouldLog('log')) {
      console.groupEnd();
    }
  }

  // Performance timing
  time(label: string): void {
    if (this.shouldLog('log')) {
      console.time(label);
    }
  }

  timeEnd(label: string): void {
    if (this.shouldLog('log')) {
      console.timeEnd(label);
    }
  }

  // Table logging for structured data
  table(data: any[]): void {
    if (this.shouldLog('log') && data) {
      console.table(data);
    }
  }

  // Assert logging
  assert(condition: boolean, ...args: any[]): void {
    if (this.shouldLog('error') && !condition) {
      console.error('[ASSERTION FAILED]', ...args);
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// For backward compatibility during migration
export const devLog = logger.log.bind(logger);
export const devError = logger.error.bind(logger);
export const devWarn = logger.warn.bind(logger);

export default logger;