// Simple server-side logging utility that respects SERVER_LOG_LEVEL environment variable
import fs, { promises as fsPromises } from 'node:fs';
import path from 'node:path';

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

// File logging support
let serverLogStream: fs.WriteStream | null = null;
let serverLogStreamPromise: Promise<fs.WriteStream> | null = null;
let isLogDirReady = false;

async function ensureServerLogPath(): Promise<string> {
  if (!isLogDirReady) {
    const logsDir = path.join(process.cwd(), 'logs');
    try {
      await fsPromises.mkdir(logsDir, { recursive: true });
      isLogDirReady = true;
    } catch {
      // Leave isLogDirReady as false so future attempts retry
    }
  }
  return path.join(process.cwd(), 'logs', 'server.log');
}

async function ensureServerLogStream(): Promise<fs.WriteStream> {
  if (serverLogStream) {
    return serverLogStream;
  }
  if (serverLogStreamPromise) {
    return serverLogStreamPromise;
  }

  serverLogStreamPromise = (async () => {
    const filePath = await ensureServerLogPath();
    const stream = fs.createWriteStream(filePath, { flags: 'a', encoding: 'utf8' });

    stream.on('error', () => {
      try {
        stream.end();
      } finally {
        serverLogStream = null;
        serverLogStreamPromise = null;
      }
    });

    stream.on('close', () => {
      serverLogStream = null;
      serverLogStreamPromise = null;
    });

    serverLogStream = stream;
    return stream;
  })();

  return serverLogStreamPromise;
}

function safeFormatArgs(args: unknown[]): string {
  if (!args || args.length === 0) {
    return '';
  }
  const parts = args.map((arg) => {
    if (typeof arg === 'string') {
      return arg;
    }
    if (arg instanceof Error) {
      return arg.stack || arg.message;
    }
    try {
      return JSON.stringify(arg);
    } catch {
      return String(arg);
    }
  });
  return parts.join(' ');
}

function writeLineToFile(
  level: keyof typeof ServerLogLevel,
  message: string,
  args: unknown[]
): void {
  // Best-effort async write; do not block or throw
  const iso = new Date().toISOString();
  const formattedArgs = safeFormatArgs(args);
  const line = formattedArgs
    ? `[${iso}] ${level} ${message} ${formattedArgs}`
    : `[${iso}] ${level} ${message}`;

  try {
    ensureServerLogStream()
      .then((stream) => {
        stream.write(line + '\n');
      })
      .catch(async () => {
        // Fallback to appendFile if stream creation failed
        try {
          const filePath = await ensureServerLogPath();
          await fsPromises.appendFile(filePath, line + '\n', 'utf8');
        } catch {
          // Swallow: logging must never crash the app
        }
      });
  } catch {
    // Swallow: logging must never crash the app
  }
}

// Ensure stream is closed on process exit
if (typeof process !== 'undefined') {
  const closeStream = () => {
    if (serverLogStream) {
      try {
        serverLogStream.end();
      } catch {}
      serverLogStream = null;
      serverLogStreamPromise = null;
    }
  };
  process.on('exit', closeStream);
  process.on('SIGINT', closeStream);
  process.on('SIGTERM', closeStream);
}

// Simple logging functions
export const logger = {
  debug: (message: string, ...args: unknown[]): void => {
    if (shouldLog(ServerLogLevel.DEBUG)) {
      console.debug(message, ...args);
      writeLineToFile('DEBUG', message, args);
    }
  },

  info: (message: string, ...args: unknown[]): void => {
    if (shouldLog(ServerLogLevel.INFO)) {
      console.info(message, ...args);
      writeLineToFile('INFO', message, args);
    }
  },

  warn: (message: string, ...args: unknown[]): void => {
    if (shouldLog(ServerLogLevel.WARN)) {
      console.warn(message, ...args);
      writeLineToFile('WARN', message, args);
    }
  },

  error: (message: string, ...args: unknown[]): void => {
    if (shouldLog(ServerLogLevel.ERROR)) {
      console.error(message, ...args);
      writeLineToFile('ERROR', message, args);
    }
  },
};

// Export current level for external use
export const currentLogLevel = getCurrentLogLevel();
