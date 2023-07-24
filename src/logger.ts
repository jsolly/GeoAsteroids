export enum LogLevel {
  ERROR,
  WARN,
  INFO,
  DEBUG,
}

export class Logger {
  consoleLevel: LogLevel;

  constructor(consoleLevel: LogLevel) {
    this.consoleLevel = consoleLevel;
  }

  debug(message: string): void {
    this.output(LogLevel.DEBUG, 'DEBUG', message);
  }

  info(message: string): void {
    this.output(LogLevel.INFO, 'INFO', message);
  }

  warn(message: string): void {
    this.output(LogLevel.WARN, 'WARN', message);
  }

  error(message: string): void {
    this.output(LogLevel.ERROR, 'ERROR', message);
  }

  logError(error: unknown): void {
    let errorMessage: string;
    if (error instanceof Error) {
      errorMessage = `${error.name}: ${error.message}`;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else {
      errorMessage = 'An unknown error occurred';
    }
    this.error(errorMessage);
  }

  private output(logLevel: LogLevel, levelName: string, message: string): void {
    const timestamp = new Date().toISOString();
    const formattedMessage = `${timestamp} - ${levelName} - ${message}`;

    // Log to console if log level is greater than or equal to console level
    if (logLevel <= this.consoleLevel) {
      console.log(formattedMessage);
    }
  }
}

// Create a logger that logs everything to files but only warnings and errors to the console
export const logger = new Logger(LogLevel.WARN);
