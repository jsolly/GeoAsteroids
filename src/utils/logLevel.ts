// Console override that respects VITE_CLIENT_LOG_LEVEL environment variable
// This allows you to use console.warn, console.info, etc. naturally

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

// Interface for console with our custom property
interface ExtendedConsole extends Console {
  _logLevelOverridden?: boolean;
}

function getCurrentLogLevel(): LogLevel {
  // Get from Vite environment variable
  const envLevel = import.meta.env.VITE_CLIENT_LOG_LEVEL;

  if (!envLevel) {
    return LogLevel.INFO; // Default to info level
  }

  switch (envLevel.toLowerCase()) {
    case 'error':
      return LogLevel.ERROR;
    case 'warn':
      return LogLevel.WARN;
    case 'info':
      return LogLevel.INFO;
    case 'debug':
      return LogLevel.DEBUG;
    default:
      return LogLevel.INFO;
  }
}

function shouldLog(level: LogLevel): boolean {
  return level <= getCurrentLogLevel();
}

// Store original console methods
const originalConsole = {
  debug: console.debug,
  info: console.info,
  warn: console.warn,
  error: console.error,
};

// Override console methods to respect log level
export function setupConsoleOverride(): void {
  // Only override if not already done
  if ((console as ExtendedConsole)._logLevelOverridden) {
    return;
  }

  console.debug = (...args: unknown[]) => {
    if (shouldLog(LogLevel.DEBUG)) {
      originalConsole.debug(...args);
    }
  };

  console.info = (...args: unknown[]) => {
    if (shouldLog(LogLevel.INFO)) {
      originalConsole.info(...args);
    }
  };

  console.warn = (...args: unknown[]) => {
    if (shouldLog(LogLevel.WARN)) {
      originalConsole.warn(...args);
    }
  };

  console.error = (...args: unknown[]) => {
    if (shouldLog(LogLevel.ERROR)) {
      originalConsole.error(...args);
    }
  };

  // Mark as overridden
  (console as ExtendedConsole)._logLevelOverridden = true;
}

// Export the current log level for external use
export const currentLogLevel = getCurrentLogLevel();

// Helper to restore original console methods if needed
export function restoreConsole(): void {
  console.debug = originalConsole.debug;
  console.info = originalConsole.info;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
  delete (console as ExtendedConsole)._logLevelOverridden;
}
