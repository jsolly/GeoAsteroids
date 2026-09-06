/**
 * Simplified Logging System
 * Forwards logs directly to server via WebSocket for file logging
 */

import { LOGGING } from '../constants';
// Logging system with automatic server forwarding
import { LogLevel, shouldEmitLog } from './logLevel';

class Logger {
  private static instance: Logger;
  private currentLevel: LogLevel;
  private static isForwarderInitialized = false;

  private constructor() {
    this.currentLevel = LogLevel.INFO;
    this.initializeLogLevel();
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private initializeLogLevel(): void {
    if (typeof window !== 'undefined') {
      const configLevel = LOGGING.GLOBAL_LOG_LEVEL;
      switch (configLevel?.toLowerCase()) {
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
    if (!shouldEmitLog(level, this.currentLevel)) {
      return;
    }

    // Format the log message
    const formattedMessage = this.formatLogMessage(level, category, message, context, error);

    // Write to console if enabled
    if (LOGGING.WRITE_TO_CONSOLE) {
      this.writeToConsole(level, formattedMessage);
    }

    // Never forward debug — even if someone opts into a debug console —
    // so a verbose client cannot stall the gameplay socket or Railway.
    if (LOGGING.FORWARD_TO_SERVER && level <= LogLevel.WARN && category !== 'LOG_FORWARD') {
      this.forwardToServer(formattedMessage);
    }
  }

  private formatLogMessage(
    level: LogLevel,
    category: string,
    message: string,
    context?: Record<string, unknown>,
    error?: Error
  ): string {
    const timestamp = new Date().toISOString();
    const levelName = LogLevel[level];
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    const errorStr = error ? ` Error: ${error.message}` : '';

    return `[${timestamp}] ${levelName} [${category}] ${message}${contextStr}${errorStr}`;
  }

  private forwardToServer(message: string): void {
    try {
      // Import and forward directly - lazy initialize on first use
      import('./logForwarder')
        .then(({ forwardLogToServer, startClientLogForwarder }) => {
          // Lazy initialize the forwarder only once
          if (!Logger.isForwarderInitialized) {
            startClientLogForwarder();
            Logger.isForwarderInitialized = true;
          }
          forwardLogToServer(message);
        })
        .catch(() => {
          // Silently fail if forwarder unavailable
        });
    } catch {
      // Silently fail if import fails
    }
  }

  private writeToConsole(level: LogLevel, message: string): void {
    switch (level) {
      case LogLevel.ERROR:
        console.error(message);
        break;
      case LogLevel.WARN:
        console.warn(message);
        break;
      case LogLevel.INFO:
        console.info(message);
        break;
      case LogLevel.DEBUG:
        console.debug(message);
        break;
    }
  }
}

// Export singleton instance
export const logger = Logger.getInstance();
