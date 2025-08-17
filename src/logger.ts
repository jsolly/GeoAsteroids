import { DEBUG, MULTIPLAYER_DEBUG } from './constants.js';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  data?: Record<string, unknown> | string | number | boolean | null;
}

class Logger {
  private static instance: Logger;
  public static originalConsole: {
    log: typeof console.log;
    warn: typeof console.warn;
    error: typeof console.error;
    debug: typeof console.debug;
    info: typeof console.info;
  };
  private isInitialized: boolean = false;
  private logLevel: LogLevel = LogLevel.DEBUG;
  private logBuffer: LogEntry[] = [];
  private bufferSize: number = 100;
  private pendingWrites: Array<{ content: string; isError: boolean }> = [];
  private isWriting: boolean = false;
  private fallbackStorage: { warnings: string[]; errors: string[] } = {
    warnings: [],
    errors: [],
  };
  private maxFallbackEntries: number = 50;

  private constructor() {
    // Initialize originalConsole before any logging begins
    if (!Logger.originalConsole) {
      Logger.originalConsole = {
        log: console.log,
        warn: console.warn,
        error: console.error,
        debug: console.debug,
        info: console.info,
      };
    }
    // Initialize logger asynchronously, but don't await in constructor
    void this.initializeLogger();
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private initializeLogger(): void {
    try {
      // Always use log server logging - no File System Access API needed
      this.isInitialized = false;
      this.setupFallbackStorage();

      // Log that we're using server-based logging
      this.log(
        LogLevel.INFO,
        'SYSTEM',
        'Logger initialized with server-based logging',
        {
          debug: DEBUG,
          multiplayerDebug: MULTIPLAYER_DEBUG,
        },
      );
    } catch (error) {
      Logger.originalConsole.error('Logger initialization failed:', error);
      // Don't throw, just fall back to console logging
      this.isInitialized = false;
      this.setupFallbackStorage();
      this.log(
        LogLevel.ERROR,
        'SYSTEM',
        'Logger initialization failed, using console-only logging',
        {
          error: error instanceof Error ? error.message : String(error),
          debug: DEBUG,
          multiplayerDebug: MULTIPLAYER_DEBUG,
        },
      );
    }
  }

  private formatLogEntry(
    level: LogLevel,
    category: string,
    message: string,
    data?: Record<string, unknown> | string | number | boolean | null,
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data,
    };
  }

  public log(
    level: LogLevel,
    category: string,
    message: string,
    data?: Record<string, unknown> | string | number | boolean | null,
  ): void {
    if (level < this.logLevel) return;

    const entry = this.formatLogEntry(level, category, message, data);

    // Format the log entry for file output
    const logLine = `[${entry.timestamp}] [${LogLevel[entry.level]}] [${category}] ${message}${entry.data ? ' ' + JSON.stringify(entry.data, null, 2) : ''}\n`;

    // Queue the write operation to avoid blocking
    // Determine if this is an error-level log entry
    const isError = level >= LogLevel.WARN;
    this.queueWrite(logLine, isError);

    // Write to console immediately using original methods to avoid recursion
    // Only show WARN and ERROR levels in browser console
    const consoleMessage = `[${entry.timestamp}] [${LogLevel[entry.level]}] [${category}] ${message}`;
    switch (level) {
      case LogLevel.DEBUG:
        // Don't output DEBUG to console
        break;
      case LogLevel.INFO:
        // Don't output INFO to console
        break;
      case LogLevel.WARN:
        Logger.originalConsole.warn(consoleMessage, data || '');
        break;
      case LogLevel.ERROR:
        Logger.originalConsole.error(consoleMessage, data || '');
        break;
    }

    // Try to send to server-side log watcher if available
    this.trySendToServerLog(entry);

    // Add to buffer for immediate access
    this.logBuffer.push(entry);
    if (this.logBuffer.length > this.bufferSize) {
      this.logBuffer.shift();
    }
  }

  private queueWrite(content: string, isError: boolean): void {
    this.pendingWrites.push({ content, isError });
    if (!this.isWriting) {
      this.processWriteQueue();
    }
  }

  private processWriteQueue(): void {
    if (this.isWriting || this.pendingWrites.length === 0) return;

    this.isWriting = true;

    try {
      while (this.pendingWrites.length > 0) {
        const writeItem = this.pendingWrites.shift();
        if (writeItem) {
          if (this.isInitialized) {
            // Try to write to file if available
            // This part is now effectively a no-op as File System Access API is removed
            this.storeInFallback(writeItem.content, writeItem.isError);
          } else {
            // Fallback to in-memory storage
            this.storeInFallback(writeItem.content, writeItem.isError);
          }
        }
      }
    } catch (error) {
      Logger.originalConsole.error('Failed to process write queue:', error);
    } finally {
      this.isWriting = false;
    }
  }

  private storeInFallback(content: string, isError: boolean): void {
    const storage = isError
      ? this.fallbackStorage.errors
      : this.fallbackStorage.warnings;
    storage.push(content);

    // Keep only the last maxFallbackEntries
    if (storage.length > this.maxFallbackEntries) {
      storage.shift();
    }

    // Automatically save to localStorage
    try {
      if (isError) {
        localStorage.setItem(
          'geoasteroids-errors',
          JSON.stringify(this.fallbackStorage.errors),
        );
      } else {
        localStorage.setItem(
          'geoasteroids-warnings',
          JSON.stringify(this.fallbackStorage.warnings),
        );
      }
    } catch (error) {
      Logger.originalConsole.error(
        'Failed to save logs to localStorage:',
        error,
      );
    }
  }

  private trySendToServerLog(entry: LogEntry): void {
    // Try to send log to server-side log watcher via fetch
    if (typeof fetch !== 'undefined') {
      this.sendLogWithRetry(entry, 0);
    }
  }

  private sendLogWithRetry(entry: LogEntry, attempt: number): void {
    const maxAttempts = 3;
    const baseDelay = 100; // Start with 100ms delay

    // Only log on first attempt and if it's a warning or error
    if (
      attempt === 0 &&
      (entry.level === LogLevel.WARN || entry.level === LogLevel.ERROR)
    ) {
      Logger.originalConsole.info(
        `Sending ${LogLevel[entry.level]} log to server:`,
        entry.message,
      );
    }

    fetch('http://localhost:3002/log', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(entry),
    })
      .then((response) => {
        if (!response.ok) {
          Logger.originalConsole.warn(
            `Failed to send log to server: ${response.status} ${response.statusText}`,
          );
        }
        // Remove success logging to reduce noise
      })
      .catch((error) => {
        // Only log errors, not warnings about retries
        if (attempt === maxAttempts - 1) {
          Logger.originalConsole.error(
            `Failed to send log to server after ${maxAttempts} attempts: ${error instanceof Error ? error.message : String(error)}`,
          );
        }

        // Retry with exponential backoff if we haven't exceeded max attempts
        if (attempt < maxAttempts - 1) {
          const delay = baseDelay * Math.pow(2, attempt);
          setTimeout(() => {
            this.sendLogWithRetry(entry, attempt + 1);
          }, delay);
        }
      });
  }

  public debug(
    category: string,
    message: string,
    data?: Record<string, unknown> | string | number | boolean | null,
  ): void {
    this.log(LogLevel.DEBUG, category, message, data);
  }

  public info(
    category: string,
    message: string,
    data?: Record<string, unknown> | string | number | boolean | null,
  ): void {
    this.log(LogLevel.INFO, category, message, data);
  }

  public warn(
    category: string,
    message: string,
    data?: Record<string, unknown> | string | number | boolean | null,
  ): void {
    this.log(LogLevel.WARN, category, message, data);
  }

  public error(
    category: string,
    message: string,
    data?: Record<string, unknown> | string | number | boolean | null,
  ): void {
    this.log(LogLevel.ERROR, category, message, data);
  }

  public getRecentLogs(count: number = 50): LogEntry[] {
    return this.logBuffer.slice(-count);
  }

  public getFallbackLogs(): { warnings: string[]; errors: string[] } {
    return {
      warnings: [...this.fallbackStorage.warnings],
      errors: [...this.fallbackStorage.errors],
    };
  }

  public displayAvailableLogs(): void {
    if (!this.isInitialized) {
      Logger.originalConsole.log('📋 GeoAsteroids Logs (LocalStorage Backup)');

      if (this.fallbackStorage.warnings.length > 0) {
        Logger.originalConsole.log(
          '⚠️ Warnings (' + this.fallbackStorage.warnings.length + '):',
        );
        this.fallbackStorage.warnings.forEach((warning, index) => {
          Logger.originalConsole.warn(`[${index + 1}] ${warning.trim()}`);
        });
      }

      if (this.fallbackStorage.errors.length > 0) {
        Logger.originalConsole.log(
          '❌ Errors (' + this.fallbackStorage.errors.length + '):',
        );
        this.fallbackStorage.errors.forEach((error, index) => {
          Logger.originalConsole.error(`[${index + 1}] ${error.trim()}`);
        });
      }

      if (
        this.fallbackStorage.warnings.length === 0 &&
        this.fallbackStorage.errors.length === 0
      ) {
        Logger.originalConsole.info('No logs available yet');
      }
    } else {
      Logger.originalConsole.info(
        '📁 Logs are being written to files in the selected directory',
      );
    }
  }

  public clearFallbackLogs(): void {
    this.fallbackStorage.warnings = [];
    this.fallbackStorage.errors = [];

    try {
      localStorage.removeItem('geoasteroids-warnings');
      localStorage.removeItem('geoasteroids-errors');
      Logger.originalConsole.info('Fallback logs cleared from localStorage');
    } catch (error) {
      Logger.originalConsole.error(
        'Failed to clear logs from localStorage:',
        error,
      );
    }
  }

  public exportAllLogs(): string {
    let exportContent = '';

    // Add file-based logs if available
    if (this.isInitialized) {
      exportContent += '=== File-based Logs ===\n';
      exportContent +=
        'Note: These logs are stored in the selected directory\n';
      exportContent += 'Location: (Not applicable - File logging disabled)\n\n';
    }

    // Add fallback storage logs
    exportContent += '=== Memory-based Logs ===\n';
    exportContent +=
      'Note: These logs are stored in memory due to file logging being disabled\n\n';

    if (this.fallbackStorage.warnings.length > 0) {
      exportContent += '--- Warnings ---\n';
      exportContent += this.fallbackStorage.warnings.join('');
      exportContent += '\n';
    }

    if (this.fallbackStorage.errors.length > 0) {
      exportContent += '--- Errors ---\n';
      exportContent += this.fallbackStorage.errors.join('');
      exportContent += '\n';
    }

    // Add recent buffer logs
    if (this.logBuffer.length > 0) {
      exportContent += '=== Recent Log Buffer ===\n';
      exportContent += this.logBuffer
        .map(
          (entry) =>
            `[${entry.timestamp}] [${LogLevel[entry.level]}] [${entry.category}] ${entry.message}${entry.data ? ' ' + JSON.stringify(entry.data, null, 2) : ''}`,
        )
        .join('\n');
    }

    return exportContent;
  }

  public downloadLogs(): Promise<void> {
    return new Promise((resolve) => {
      const content = this.exportAllLogs();
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `geoasteroids-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      resolve();
    });
  }

  public getAllLogs(): Promise<LogEntry[]> {
    // This method is no longer needed as File System Access API is removed.
    // Keeping it for now in case it's called elsewhere, but it will throw an error.
    return Promise.reject(
      new Error('File logging is disabled. Cannot read log files.'),
    );
  }

  public clearLogs(): void {
    try {
      this.logBuffer = [];

      // This part is now effectively a no-op as File System Access API is removed
      // No need to log warnings about disabled functionality

      this.info('LOGGER', 'All logs cleared');
    } catch (error) {
      console.error('Failed to clear logs:', error);
      throw error;
    }
  }

  public setLogLevel(level: LogLevel): void {
    this.logLevel = level;
    this.info('LOGGER', 'Log level changed', { newLevel: LogLevel[level] });
  }

  public isFileLoggingEnabled(): boolean {
    return false; // File logging is disabled
  }

  public getLogDirectoryPath(): string | null {
    return null; // No directory path available
  }

  // Method to manually log any existing console errors
  public logExistingConsoleErrors(): void {
    try {
      // Check if there are any error messages in the console that we might have missed
      if (typeof window !== 'undefined' && window.console) {
        // Log a summary of the current console state
        this.info('LOGGER', 'Console error check completed', {
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href,
        });
      }
    } catch {
      // If this fails, at least log that it failed
      Logger.originalConsole.error('Failed to log existing console errors');
    }
  }

  private setupFallbackStorage(): void {
    // Set up fallback storage for warnings and errors
    // Silent setup - no console output needed

    // Load existing logs from localStorage if available
    try {
      const storedWarnings = localStorage.getItem('geoasteroids-warnings');
      const storedErrors = localStorage.getItem('geoasteroids-errors');

      if (storedWarnings) {
        this.fallbackStorage.warnings = JSON.parse(storedWarnings) as string[];
      }
      if (storedErrors) {
        this.fallbackStorage.errors = JSON.parse(storedErrors) as string[];
      }
    } catch (error) {
      Logger.originalConsole.error(
        'Failed to load logs from localStorage:',
        error,
      );
    }
  }
}

// Export singleton instance
export const logger = Logger.getInstance();

// Export convenience functions
export const logDebug = (
  category: string,
  message: string,
  data?: Record<string, unknown>,
): void => logger.debug(category, message, data);
export const logInfo = (
  category: string,
  message: string,
  data?: Record<string, unknown>,
): void => logger.info(category, message, data);
export const logWarn = (
  category: string,
  message: string,
  data?: Record<string, unknown>,
): void => logger.warn(category, message, data);
export const logError = (
  category: string,
  message: string,
  data?: Record<string, unknown>,
): void => logger.error(category, message, data);
export const logExistingErrors = (): void => logger.logExistingConsoleErrors();

// Set up global error handlers to capture all browser errors
function setupGlobalErrorHandlers(): void {
  // Capture unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    // Use a flag to prevent infinite recursion
    if (!(console as unknown as { _isLogging?: boolean })._isLogging) {
      (console as unknown as { _isLogging?: boolean })._isLogging = true;
      try {
        const logWatcherInstance = (
          window as unknown as {
            logWatcherInstance?: {
              writeLog: (
                level: string,
                category: string,
                message: string,
                data: Record<string, unknown>,
              ) => void;
            };
          }
        ).logWatcherInstance;
        if (logWatcherInstance) {
          logWatcherInstance.writeLog(
            'ERROR',
            'UNHANDLED_PROMISE',
            'Unhandled promise rejection',
            {
              reason: event.reason,
              promise: event.promise,
            },
          );
        }
      } finally {
        (console as unknown as { _isLogging?: boolean })._isLogging = false;
      }
    }
  });

  // Capture JavaScript errors
  window.addEventListener('error', (event) => {
    // Use a flag to prevent infinite recursion
    if (!(console as unknown as { _isLogging?: boolean })._isLogging) {
      (console as unknown as { _isLogging?: boolean })._isLogging = true;
      try {
        const logWatcherInstance = (
          window as unknown as {
            logWatcherInstance?: {
              writeLog: (
                level: string,
                category: string,
                message: string,
                data: Record<string, unknown>,
              ) => void;
            };
          }
        ).logWatcherInstance;
        if (logWatcherInstance) {
          logWatcherInstance.writeLog(
            'ERROR',
            'JAVASCRIPT_ERROR',
            'JavaScript error occurred',
            {
              message: event.message,
              filename: event.filename,
              lineno: event.lineno,
              colno: event.colno,
              error:
                event.error instanceof Error
                  ? event.error.stack || event.error.message
                  : event.error,
            },
          );
        }
      } finally {
        (console as unknown as { _isLogging?: boolean })._isLogging = false;
      }
    }
  });

  // Capture resource loading errors
  window.addEventListener(
    'error',
    (event) => {
      if (event.target && event.target !== window) {
        const target = event.target as HTMLElement;
        // Use a flag to prevent infinite recursion
        if (!(console as unknown as { _isLogging?: boolean })._isLogging) {
          (console as unknown as { _isLogging?: boolean })._isLogging = true;
          try {
            const logWatcherInstance = (
              window as unknown as {
                logWatcherInstance?: {
                  writeLog: (
                    level: string,
                    category: string,
                    message: string,
                    data: Record<string, unknown>,
                  ) => void;
                };
              }
            ).logWatcherInstance;
            if (logWatcherInstance) {
              const src = (target as unknown as { src?: string }).src;
              const href = (target as unknown as { href?: string }).href;
              logWatcherInstance.writeLog(
                'ERROR',
                'RESOURCE_ERROR',
                'Resource failed to load',
                {
                  tagName: target.tagName,
                  src,
                  href,
                  type: event.type,
                },
              );
            }
          } finally {
            (console as unknown as { _isLogging?: boolean })._isLogging = false;
          }
        }
      }
    },
    true,
  );

  // Use the static originalConsole from Logger class

  // Override console.log - suppress output but still log to file
  console.log = (...args): void => {
    // Don't output to browser console, only log to file
    // Use a flag to prevent infinite recursion
    if (!(console as unknown as { _isLogging?: boolean })._isLogging) {
      (console as unknown as { _isLogging?: boolean })._isLogging = true;
      try {
        const logWatcherInstance = (
          window as unknown as {
            logWatcherInstance?: {
              writeLog: (
                level: string,
                category: string,
                message: string,
                data: Record<string, unknown>,
              ) => void;
            };
          }
        ).logWatcherInstance;
        if (logWatcherInstance) {
          logWatcherInstance.writeLog('INFO', 'CONSOLE', 'Console log called', {
            args: args.map((arg) => String(arg)),
          });
        }
      } finally {
        (console as unknown as { _isLogging?: boolean })._isLogging = false;
      }
    }
  };

  // Override console.warn
  console.warn = (...args): void => {
    Logger.originalConsole.warn(...args);
    // Use a flag to prevent infinite recursion
    if (!(console as unknown as { _isLogging?: boolean })._isLogging) {
      (console as unknown as { _isLogging?: boolean })._isLogging = true;
      try {
        const logWatcherInstance = (
          window as unknown as {
            logWatcherInstance?: {
              writeLog: (
                level: string,
                category: string,
                message: string,
                data: Record<string, unknown>,
              ) => void;
            };
          }
        ).logWatcherInstance;
        if (logWatcherInstance) {
          logWatcherInstance.writeLog(
            'WARN',
            'CONSOLE',
            'Console warning called',
            {
              args: args.map((arg) => String(arg)),
            },
          );
        }
      } finally {
        (console as unknown as { _isLogging?: boolean })._isLogging = false;
      }
    }
  };

  // Override console.error
  console.error = (...args): void => {
    Logger.originalConsole.error(...args);
    // Use a flag to prevent infinite recursion
    if (!(console as unknown as { _isLogging?: boolean })._isLogging) {
      (console as unknown as { _isLogging?: boolean })._isLogging = true;
      try {
        // Write directly to the log buffer to avoid recursion
        // Note: entry is not used in this override, but kept for consistency

        // Add to log buffer directly
        const logWatcherInstance = (
          window as unknown as {
            logWatcherInstance?: {
              writeLog: (
                level: string,
                category: string,
                message: string,
                data: Record<string, unknown>,
              ) => void;
            };
          }
        ).logWatcherInstance;
        if (logWatcherInstance) {
          logWatcherInstance.writeLog(
            'ERROR',
            'CONSOLE',
            'Console error called',
            {
              args: args.map((arg) => String(arg)),
            },
          );
        }
      } finally {
        (console as unknown as { _isLogging?: boolean })._isLogging = false;
      }
    }
  };

  // Override console.debug - suppress output but still log to file
  console.debug = (...args): void => {
    // Don't output to browser console, only log to file
    // Use a flag to prevent infinite recursion
    if (!(console as unknown as { _isLogging?: boolean })._isLogging) {
      (console as unknown as { _isLogging?: boolean })._isLogging = true;
      try {
        const logWatcherInstance = (
          window as unknown as {
            logWatcherInstance?: {
              writeLog: (
                level: string,
                category: string,
                message: string,
                data: Record<string, unknown>,
              ) => void;
            };
          }
        ).logWatcherInstance;
        if (logWatcherInstance) {
          logWatcherInstance.writeLog(
            'DEBUG',
            'CONSOLE',
            'Console debug called',
            {
              args: args.map((arg) => String(arg)),
            },
          );
        }
      } finally {
        (console as unknown as { _isLogging?: boolean })._isLogging = false;
      }
    }
  };

  // Override console.info - suppress output but still log to file
  console.info = (...args): void => {
    // Don't output to browser console, only log to file
    // Use a flag to prevent infinite recursion
    if (!(console as unknown as { _isLogging?: boolean })._isLogging) {
      (console as unknown as { _isLogging?: boolean })._isLogging = true;
      try {
        const logWatcherInstance = (
          window as unknown as {
            logWatcherInstance?: {
              writeLog: (
                level: string,
                category: string,
                message: string,
                data: Record<string, unknown>,
              ) => void;
            };
          }
        ).logWatcherInstance;
        if (logWatcherInstance) {
          logWatcherInstance.writeLog(
            'INFO',
            'CONSOLE',
            'Console info called',
            {
              args: args.map((arg) => String(arg)),
            },
          );
        }
      } finally {
        (console as unknown as { _isLogging?: boolean })._isLogging = false;
      }
    }
  };

  // Override fetch to capture network errors
  const originalFetch = window.fetch;
  window.fetch = async (...args): Promise<Response> => {
    try {
      const response = await originalFetch(...args);
      if (!response.ok) {
        // Use a flag to prevent infinite recursion
        if (!(console as unknown as { _isLogging?: boolean })._isLogging) {
          (console as unknown as { _isLogging?: boolean })._isLogging = true;
          try {
            const logWatcherInstance = (
              window as unknown as {
                logWatcherInstance?: {
                  writeLog: (
                    level: string,
                    category: string,
                    message: string,
                    data: Record<string, unknown>,
                  ) => void;
                };
              }
            ).logWatcherInstance;
            if (logWatcherInstance) {
              logWatcherInstance.writeLog(
                'WARN',
                'NETWORK',
                'Fetch request failed',
                {
                  url: args[0],
                  status: response.status,
                  statusText: response.statusText,
                },
              );
            }
          } finally {
            (console as unknown as { _isLogging?: boolean })._isLogging = false;
          }
        }
      }
      return response;
    } catch (error) {
      // Use a flag to prevent infinite recursion
      if (!(console as unknown as { _isLogging?: boolean })._isLogging) {
        (console as unknown as { _isLogging?: boolean })._isLogging = true;
        try {
          const logWatcherInstance = (
            window as unknown as {
              logWatcherInstance?: {
                writeLog: (
                  level: string,
                  category: string,
                  message: string,
                  data: Record<string, unknown>,
                ) => void;
              };
            }
          ).logWatcherInstance;
          if (logWatcherInstance) {
            logWatcherInstance.writeLog(
              'ERROR',
              'NETWORK',
              'Fetch request error',
              {
                url: args[0],
                error: error instanceof Error ? error.message : String(error),
              },
            );
          }
        } finally {
          (console as unknown as { _isLogging?: boolean })._isLogging = false;
        }
      }
      throw error;
    }
  };

  // Log that error handlers are set up
  // Use a flag to prevent infinite recursion
  if (!(console as unknown as { _isLogging?: boolean })._isLogging) {
    (console as unknown as { _isLogging?: boolean })._isLogging = true;
    try {
      const logWatcherInstance = (
        window as unknown as {
          logWatcherInstance?: {
            writeLog: (
              level: string,
              category: string,
              message: string,
              data: Record<string, unknown>,
            ) => void;
          };
        }
      ).logWatcherInstance;
      if (logWatcherInstance) {
        logWatcherInstance.writeLog(
          'INFO',
          'LOGGER',
          'Global error handlers, console overrides, and network monitoring installed',
          {},
        );
      }
    } finally {
      (console as unknown as { _isLogging?: boolean })._isLogging = false;
    }
  }
}

// Initialize global error handlers when the module loads
if (typeof window !== 'undefined') {
  setupGlobalErrorHandlers();

  // Also set up a periodic check for any console errors that might have been missed
  setInterval((): void => {
    // Check if there are any unhandled errors in the console
    const consoleWithErrorCount = window.console as unknown as {
      errorCount?: number;
    };
    if (
      window.console &&
      consoleWithErrorCount.errorCount &&
      consoleWithErrorCount.errorCount > 0
    ) {
      // Use a flag to prevent infinite recursion
      if (!(console as unknown as { _isLogging?: boolean })._isLogging) {
        (console as unknown as { _isLogging?: boolean })._isLogging = true;
        try {
          const logWatcherInstance = (
            window as unknown as {
              logWatcherInstance?: {
                writeLog: (
                  level: string,
                  category: string,
                  message: string,
                  data: Record<string, unknown>,
                ) => void;
              };
            }
          ).logWatcherInstance;
          if (logWatcherInstance) {
            logWatcherInstance.writeLog(
              'WARN',
              'LOGGER',
              'Console error count detected',
              {
                errorCount: consoleWithErrorCount.errorCount,
              },
            );
          }
        } finally {
          (console as unknown as { _isLogging?: boolean })._isLogging = false;
        }
      }
    }
  }, 5000); // Check every 5 seconds

  // Expose logger globally for manual debugging
  (window as unknown as { logger?: Record<string, unknown> }).logger = {
    debug: logDebug,
    info: logInfo,
    warn: logWarn,
    error: logError,
    logExistingErrors,
    getRecentLogs: (): LogEntry[] => logger.getRecentLogs(),
    downloadLogs: (): Promise<void> => logger.downloadLogs(),
    clearLogs: (): Promise<void> => Promise.resolve(logger.clearLogs()),
  };

  // Use a flag to prevent infinite recursion
  if (!(console as unknown as { _isLogging?: boolean })._isLogging) {
    (console as unknown as { _isLogging?: boolean })._isLogging = true;
    try {
      const logWatcherInstance = (
        window as unknown as {
          logWatcherInstance?: {
            writeLog: (
              level: string,
              category: string,
              message: string,
              data: Record<string, unknown>,
            ) => void;
          };
        }
      ).logWatcherInstance;
      if (logWatcherInstance) {
        logWatcherInstance.writeLog(
          'INFO',
          'LOGGER',
          'Logger exposed globally as window.logger',
          {},
        );
      }
    } finally {
      (console as unknown as { _isLogging?: boolean })._isLogging = false;
    }
  }
}
