/**
 * Centralized Logging System
 * Provides consistent logging across the application
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

export interface LogEntry {
  readonly timestamp: Date;
  readonly level: LogLevel;
  readonly category: string;
  readonly message: string;
  readonly context?: Record<string, unknown>;
  readonly error?: Error;
}

export class Logger {
  private static instance: Logger;
  private currentLevel: LogLevel = LogLevel.INFO;
  private logs: LogEntry[] = [];
  private maxLogs: number = 1000;

  private constructor() {
    this.initializeLogLevel();
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private initializeLogLevel(): void {
    if (typeof window !== 'undefined') {
      const envLevel = import.meta.env.VITE_CLIENT_LOG_LEVEL;
      switch (envLevel?.toLowerCase()) {
        case 'debug':
          this.currentLevel = LogLevel.DEBUG;
          break;
        case 'info':
          this.currentLevel = LogLevel.INFO;
          break;
        case 'warn':
          this.currentLevel = LogLevel.WARN;
          break;
        case 'error':
          this.currentLevel = LogLevel.ERROR;
          break;
        case 'none':
          this.currentLevel = LogLevel.NONE;
          break;
        default:
          this.currentLevel = LogLevel.INFO;
      }
    }
  }

  setLogLevel(level: LogLevel): void {
    this.currentLevel = level;
  }

  getLogLevel(): LogLevel {
    return this.currentLevel;
  }

  debug(category: string, message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, category, message, context);
  }

  info(category: string, message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, category, message, context);
  }

  warn(category: string, message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, category, message, context);
  }

  error(category: string, message: string, error?: Error, context?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, category, message, context, error);
  }

  private log(
    level: LogLevel,
    category: string,
    message: string,
    context?: Record<string, unknown>,
    error?: Error
  ): void {
    // Always store log entry regardless of currentLevel
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      category,
      message,
      context,
      error,
    };

    // Store log entry
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift(); // Remove oldest entry
    }

    // Always forward to server for file logging, regardless of currentLevel
    const formattedMessage = this.formatLogMessage(entry);
    this.outputLog(level, formattedMessage);
  }

  private formatLogMessage(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const levelName = LogLevel[entry.level];
    const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
    const errorStr = entry.error ? ` Error: ${entry.error.message}` : '';

    return `[${timestamp}] ${levelName} [${entry.category}] ${entry.message}${contextStr}${errorStr}`;
  }

  private outputLog(_level: LogLevel, message: string): void {
    // Forwarding is controlled at runtime by the console override/forwarder
    // Only forward if the forwarder has been started and opted in
    const forwarderEnabled =
      typeof window !== 'undefined' &&
      (window as { __logForwarderEnabled?: boolean }).__logForwarderEnabled === true;

    if (forwarderEnabled) {
      try {
        // Import dynamically to avoid circular dependency
        import('./logForwarder')
          .then(({ forwardLogToServer }) => {
            try {
              forwardLogToServer(message);
            } catch (forwardError) {
              console.warn('Failed to forward log to server:', forwardError);
            }
          })
          .catch((importError) => {
            console.warn('Failed to import log forwarder:', importError);
          });
      } catch (error) {
        console.warn('Log forwarding failed:', error);
      }
    }
  }

  getLogs(level?: LogLevel): LogEntry[] {
    if (level === undefined) {
      return [...this.logs];
    }
    return this.logs.filter((log) => log.level >= level);
  }

  clearLogs(): void {
    this.logs = [];
  }

  getRecentLogs(count: number = 50): LogEntry[] {
    return this.logs.slice(-count);
  }

  // Performance monitoring
  time(label: string): () => void {
    const start = performance.now();
    return () => {
      const end = performance.now();
      const duration = end - start;
      this.debug('PERFORMANCE', `${label} took ${duration.toFixed(2)}ms`);
    };
  }

  // Error boundary helper
  withErrorHandling<T>(
    operation: () => T,
    category: string,
    operationName: string,
    fallback?: T
  ): T | undefined {
    try {
      return operation();
    } catch (error) {
      this.error(category, `${operationName} failed`, error as Error);
      return fallback;
    }
  }
}

// Export singleton instance
export const logger = Logger.getInstance();

// Convenience functions for common use cases
export const log = {
  debug: (category: string, message: string, context?: Record<string, unknown>) =>
    logger.debug(category, message, context),
  info: (category: string, message: string, context?: Record<string, unknown>) =>
    logger.info(category, message, context),
  warn: (category: string, message: string, context?: Record<string, unknown>) =>
    logger.warn(category, message, context),
  error: (category: string, message: string, error?: Error, context?: Record<string, unknown>) =>
    logger.error(category, message, error, context),
};
