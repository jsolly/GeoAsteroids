// Log level definitions for the logging system
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

/**
 * Standard severity filter: emit when the message is at or above the
 * threshold (ERROR is most severe). The previous `level < threshold`
 * comparison inverted this, so `debug()` always printed and `error()`
 * vanished whenever GLOBAL_LOG_LEVEL was `info` or `debug`.
 */
export function shouldEmitLog(messageLevel: LogLevel, threshold: LogLevel): boolean {
  return messageLevel <= threshold;
}
