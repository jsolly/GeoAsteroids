import fs from 'node:fs';
import { promises as fsPromises } from 'node:fs';
import path from 'node:path';
import { logger } from '../../setup/serverLogger';

export class ClientLogger {
  private static clientLogFilePath: string | null = null;
  private static isLogDirReady = false;
  private static clientLogStream: fs.WriteStream | null = null;
  private static clientLogStreamPromise: Promise<fs.WriteStream> | null = null;

  private static async ensureClientLogPath(): Promise<string> {
    if (!ClientLogger.isLogDirReady) {
      const logsDir = path.join(process.cwd(), 'logs');
      try {
        await fsPromises.mkdir(logsDir, { recursive: true });
        ClientLogger.isLogDirReady = true;
      } catch (error) {
        // Log error but do not set the flag - future attempts can retry creating the directory
        logger.warn('Failed to create logs directory:', error);
      }
    }
    if (!ClientLogger.clientLogFilePath) {
      ClientLogger.clientLogFilePath = path.join(process.cwd(), 'logs', 'client.log');
    }
    return ClientLogger.clientLogFilePath;
  }

  private static async ensureClientLogStream(): Promise<fs.WriteStream> {
    // If there's already an in-flight promise, await it
    if (ClientLogger.clientLogStreamPromise) {
      return ClientLogger.clientLogStreamPromise;
    }

    // If stream already exists, return it
    if (ClientLogger.clientLogStream) {
      return ClientLogger.clientLogStream;
    }

    // Create the promise and store it to prevent race conditions
    ClientLogger.clientLogStreamPromise = (async (): Promise<fs.WriteStream> => {
      try {
        const filePath = await ClientLogger.ensureClientLogPath();
        ClientLogger.clientLogStream = fs.createWriteStream(filePath, {
          flags: 'a',
          encoding: 'utf8'
        });

        // Handle stream errors
        ClientLogger.clientLogStream.on('error', (error) => {
          logger.warn('Client log stream error:', error);
          // Reset stream and promise on error
          if (ClientLogger.clientLogStream) {
            ClientLogger.clientLogStream.end();
            ClientLogger.clientLogStream = null;
          }
          ClientLogger.clientLogStreamPromise = null;
        });

        // Handle stream close
        ClientLogger.clientLogStream.on('close', () => {
          logger.debug('Client log stream closed');
          ClientLogger.clientLogStream = null;
          ClientLogger.clientLogStreamPromise = null;
        });

        return ClientLogger.clientLogStream;
      } catch (error) {
        // Reset promise on failure so future attempts can retry
        ClientLogger.clientLogStreamPromise = null;
        logger.warn('Failed to create client log stream:', error);
        throw error;
      }
    })();

    return ClientLogger.clientLogStreamPromise;
  }

  private static async appendClientLogFallback(line: string): Promise<void> {
    try {
      const filePath = await ClientLogger.ensureClientLogPath();
      await fsPromises.appendFile(filePath, line + '\n', 'utf8');
    } catch (error) {
      logger.warn('Failed to append to client.log fallback:', error);
    }
  }

  public static async logClientMessage(data: {
    level?: string;
    line?: string;
    message?: string;
    sessionId?: string;
    userAgent?: string;
    pageUrl?: string;
  }): Promise<void> {
    const nowIso = new Date().toISOString();
    const level = (data.level ?? 'INFO') as string;
    const line = typeof data.line === 'string' ? data.line : undefined;
    const message = typeof data.message === 'string' ? data.message : undefined;
    const sessionId = typeof data.sessionId === 'string' ? data.sessionId : 'unknown-session';
    const userAgent = typeof data.userAgent === 'string' ? data.userAgent : undefined;
    const pageUrl = typeof data.pageUrl === 'string' ? data.pageUrl : undefined;

    const rendered =
      line || `[${nowIso}] ${level} [session:${sessionId}] ${message ?? ''}`;
    const withMeta = userAgent || pageUrl
      ? `${rendered} ${userAgent ? `(ua:${userAgent})` : ''} ${pageUrl ? `(url:${pageUrl})` : ''}`.trim()
      : rendered;

    // Use setImmediate to prevent blocking the WebSocket event loop
    setImmediate(async () => {
      try {
        const stream = await ClientLogger.ensureClientLogStream();
        // Use callback to handle write errors without throwing
        stream.write(withMeta + '\n', 'utf8', (error) => {
          if (error) {
            logger.warn('Failed to write to client log stream:', error);
            // Reset stream on write error
            if (ClientLogger.clientLogStream) {
              ClientLogger.clientLogStream.end();
              ClientLogger.clientLogStream = null;
            }
            // Fall back to appendFile
            ClientLogger.appendClientLogFallback(withMeta).catch((fallbackError) => {
              logger.warn('Failed to append to client.log via fallback:', fallbackError);
            });
          }
        });
      } catch (error) {
        logger.warn('Failed to get client log stream, using fallback:', error);
        // Fall back to appendFile if stream is unavailable
        try {
          await ClientLogger.appendClientLogFallback(withMeta);
        } catch (fallbackError) {
          logger.warn('Failed to append to client.log via fallback:', fallbackError);
        }
      }
    });
  }
}
