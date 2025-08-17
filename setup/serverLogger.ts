// Simple server-side logging utility that respects SERVER_LOG_LEVEL environment variable

export enum ServerLogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

function getCurrentLogLevel(): ServerLogLevel {
  const envLevel = process.env.SERVER_LOG_LEVEL;

  if (!envLevel) {
    return ServerLogLevel.INFO; // Default to info level
  }

  switch (envLevel.toLowerCase()) {
    case 'error':
      return ServerLogLevel.ERROR;
    case 'warn':
      return ServerLogLevel.WARN;
    case 'info':
      return ServerLogLevel.INFO;
    case 'debug':
      return ServerLogLevel.DEBUG;
    default:
      return ServerLogLevel.INFO;
  }
}

function shouldLog(level: ServerLogLevel): boolean {
  return level <= getCurrentLogLevel();
}

// Simple logging functions
export const logger = {
  debug: (message: string, ...args: unknown[]): void => {
    if (shouldLog(ServerLogLevel.DEBUG)) {
      console.debug(message, ...args);
    }
  },

  info: (message: string, ...args: unknown[]): void => {
    if (shouldLog(ServerLogLevel.INFO)) {
      console.info(message, ...args);
    }
  },

  warn: (message: string, ...args: unknown[]): void => {
    if (shouldLog(ServerLogLevel.WARN)) {
      console.warn(message, ...args);
    }
  },

  error: (message: string, ...args: unknown[]): void => {
    if (shouldLog(ServerLogLevel.ERROR)) {
      console.error(message, ...args);
    }
  },
};

// Export current level for external use
export const currentLogLevel = getCurrentLogLevel();
