// Simple logging utility that respects VITE_LOG_LEVEL environment variable
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

function getCurrentLogLevel(): LogLevel {
  const envLevel = (
    import.meta.env?.VITE_LOG_LEVEL as string | undefined
  )?.toLowerCase();

  switch (envLevel) {
    case 'error':
      return LogLevel.ERROR;
    case 'warn':
      return LogLevel.WARN;
    case 'info':
      return LogLevel.INFO;
    case 'debug':
      return LogLevel.DEBUG;
    default:
      return LogLevel.WARN; // Default to warn level
  }
}

function shouldLog(level: LogLevel): boolean {
  return level <= getCurrentLogLevel();
}

// Store original console methods
const originalConsole = {
  debug: console.debug,
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error,
};

// Override console methods to respect log level
console.debug = (...args: unknown[]): void => {
  if (shouldLog(LogLevel.DEBUG)) {
    originalConsole.debug(...args);
  }
};

console.log = (...args: unknown[]): void => {
  if (shouldLog(LogLevel.INFO)) {
    originalConsole.log(...args);
  }
};

console.info = (...args: unknown[]): void => {
  if (shouldLog(LogLevel.INFO)) {
    originalConsole.info(...args);
  }
};

console.warn = (...args: unknown[]): void => {
  if (shouldLog(LogLevel.WARN)) {
    originalConsole.warn(...args);
  }
};

console.error = (...args: unknown[]): void => {
  if (shouldLog(LogLevel.ERROR)) {
    originalConsole.error(...args);
  }
};
