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
    // Default to DEBUG in development for better visibility, INFO otherwise
    const isDev = import.meta.env?.DEV === true || import.meta.env?.MODE === 'development';
    return isDev ? LogLevel.DEBUG : LogLevel.INFO;
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

// In-memory buffer of logs that passed the current log level filter
// Kept intentionally simple for easy copy/export from DevTools
const MAX_LOG_BUFFER_LINES = 5000;
const logBuffer: string[] = [];

function stringifyArg(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

type LevelName = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

function appendToLogBuffer(level: LevelName, args: unknown[]): void {
  const timestampIso = new Date().toISOString();
  const rendered = args.map(stringifyArg).join(' ');
  logBuffer.push(`[${timestampIso}] ${level} ${rendered}`);
  if (logBuffer.length > MAX_LOG_BUFFER_LINES) {
    // Trim oldest entries to keep memory bounded
    logBuffer.splice(0, logBuffer.length - MAX_LOG_BUFFER_LINES);
  }
}

export function getLogsAsText(): string {
  return logBuffer.join('\n');
}

export function clearLogBuffer(): void {
  logBuffer.length = 0;
}

export async function copyLogs(): Promise<void> {
  const text = getLogsAsText();

  try {
    // Prefer the DevTools helper if present (works without user gesture)
    const g = globalThis as unknown as { copy?: (data: unknown) => void } & typeof globalThis;
    if (typeof g.copy === 'function') {
      g.copy(text);
      return;
    }

    // Use modern clipboard API as primary method
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    // Fallback: create a temporary textarea and select/copy
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();

    // Modern clipboard fallback - show text to user for manual copy
    try {
      // Try to use the modern clipboard API first
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        document.body.removeChild(textarea);
        return;
      }
    } catch {
      // Fall through to manual copy approach
    }

    // Manual copy approach - show text in alert for user to copy
    document.body.removeChild(textarea);
    alert(
      `Logs copied to clipboard:\n\n${text.substring(0, 1000)}${text.length > 1000 ? '...' : ''}`
    );
    throw new Error('Modern clipboard API not available');
  } catch (error) {
    // Log the error and fall back to printing the text
    console.warn('Failed to copy logs to clipboard:', error);
    originalConsole.info(text);
  }
}

// Set up global error handlers for JavaScript errors and unhandled promise rejections
export function setupErrorHandlers(): void {
  // Capture JavaScript errors
  window.addEventListener('error', (event: ErrorEvent) => {
    console.error('JAVASCRIPT_ERROR', 'JavaScript error occurred', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error:
        event.error instanceof Error
          ? event.error.stack || event.error.message
          : String(event.error),
    });
  });

  // Capture unhandled promise rejections
  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    console.error('UNHANDLED_PROMISE', 'Unhandled promise rejection', {
      reason: String(event.reason),
    });
  });
}

// Override console methods to respect log level
export function setupConsoleOverride(): void {
  // Only override if not already done
  if ((console as ExtendedConsole)._logLevelOverridden) {
    return;
  }

  console.debug = (...args: unknown[]) => {
    // Ensure override is applied (defensive programming)
    if (!(console as ExtendedConsole)._logLevelOverridden) {
      setupConsoleOverride();
    }
    if (shouldLog(LogLevel.DEBUG)) {
      originalConsole.debug(...args);
      appendToLogBuffer('DEBUG', args);
    }
  };

  console.info = (...args: unknown[]) => {
    // Ensure override is applied (defensive programming)
    if (!(console as ExtendedConsole)._logLevelOverridden) {
      setupConsoleOverride();
    }
    if (shouldLog(LogLevel.INFO)) {
      originalConsole.info(...args);
      appendToLogBuffer('INFO', args);
    }
  };

  console.warn = (...args: unknown[]) => {
    // Ensure override is applied (defensive programming)
    if (!(console as ExtendedConsole)._logLevelOverridden) {
      setupConsoleOverride();
    }
    if (shouldLog(LogLevel.WARN)) {
      originalConsole.warn(...args);
      appendToLogBuffer('WARN', args);
    }
  };

  console.error = (...args: unknown[]) => {
    // Ensure override is applied (defensive programming)
    if (!(console as ExtendedConsole)._logLevelOverridden) {
      setupConsoleOverride();
    }
    if (shouldLog(LogLevel.ERROR)) {
      originalConsole.error(...args);
      appendToLogBuffer('ERROR', args);
    }
  };

  // Mark as overridden
  (console as ExtendedConsole)._logLevelOverridden = true;
}

// Auto-setup console override when this module is imported
// This ensures the override is applied as soon as possible
setupConsoleOverride();

// Auto-setup error handlers when this module is imported
// This ensures error handling is applied as soon as possible
setupErrorHandlers();

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
