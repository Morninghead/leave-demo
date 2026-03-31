/**
 * Backend logging utility for Netlify Functions
 * Development-only logging with structured output
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

// Check if we're in development/preview environment
const isDevelopment = process.env.NODE_ENV === 'development' ||
                     process.env.NETLIFY_ENV === 'dev' ||
                     process.env.CONTEXT === 'dev' ||
                     process.env.CONTEXT === 'deploy-preview';

// Configuration
const config: LoggerConfig = {
  enableInProduction: false, // Set to true if you want some logs in production
  logLevels: {
    error: isDevelopment ? true : true, // Always show errors
    warn: isDevelopment ? true : false,
    info: isDevelopment ? true : false,
    log: isDevelopment ? true : false,
    debug: isDevelopment ? true : false,
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

  // Database query logging (useful for debugging)
  query(sql: string, params?: any[]): void {
    if (this.shouldLog('debug')) {
      console.log(`[${new Date().toISOString()}] [QUERY]`, sql);
      if (params && params.length > 0) {
        console.log(`[${new Date().toISOString()}] [PARAMS]`, params);
      }
    }
  }

  // API request logging
  request(method: string, path: string, userId?: string): void {
    if (this.shouldLog('info')) {
      console.log(`[${new Date().toISOString()}] [REQUEST]`, method, path, userId ? `User: ${userId}` : '');
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

  // Structured logging for better parsing
  structured(level: LogLevel, event: string, data?: any): void {
    if (!this.shouldLog(level)) return;

    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      event,
      ...(data && { data })
    };

    console.log(JSON.stringify(logEntry));
  }
}

// Export singleton instance
export const logger = new Logger();

export default logger;