import { writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface LogEntry {
  timestamp: string;
  level: string;
  category: string;
  message: string;
  data?: Record<string, unknown> | string | number | boolean | null;
}

class LogAPI {
  private logFile: string;

  constructor() {
    // Create logs directory in project root
    const logsDir = join(__dirname, '..', 'logs');
    this.logFile = join(logsDir, 'debug-logs.txt');

    // Ensure logs directory exists
    if (!existsSync(logsDir)) {
      mkdirSync(logsDir, { recursive: true });
    }

    // Ensure log file exists with header
    if (!existsSync(this.logFile)) {
      const header = `=== GeoAsteroids Debug Log ===
Started: ${new Date().toISOString()}
Debug Mode: true
Multiplayer Debug: true
Log Level: DEBUG
=====================================\n\n`;
      writeFileSync(this.logFile, header);
    }
  }

  private safeStringify(data: unknown): string {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  }

  writeLog(entry: LogEntry): void {
    try {
      const dataString =
        entry.data !== null && entry.data !== undefined
          ? ' ' + this.safeStringify(entry.data)
          : '';
      const logLine = `[${entry.timestamp}] [${entry.level}] [${entry.category}] ${entry.message}${dataString}\n`;
      appendFileSync(this.logFile, logLine);

      // Also log to console for visibility
      console.log(`[BROWSER LOG] ${logLine.trim()}`);
    } catch (error) {
      console.error('Failed to write browser log to file:', error);
    }
  }

  handleLogRequest(entry: LogEntry): { success: boolean; message: string } {
    try {
      this.writeLog(entry);
      return { success: true, message: 'Log written successfully' };
    } catch (error) {
      return {
        success: false,
        message: `Failed to write log: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}

// Create singleton instance
const logAPI = new LogAPI();

// Export for use in other files
export default logAPI;

// If this file is run directly, set up a simple HTTP server for testing
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Starting log API server...');

  // Simple HTTP server for testing
  const http = await import('http');

  const server = http.createServer((req, res) => {
    // Add CORS headers to allow requests from the game
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.method === 'POST' && req.url === '/api/log') {
      let body = '';
      req.on('data', (chunk: Buffer) => {
        body += chunk.toString();
      });

      req.on('end', () => {
        try {
          const parsedBody: unknown = JSON.parse(body);
          if (
            typeof parsedBody === 'object' &&
            parsedBody !== null &&
            'timestamp' in parsedBody &&
            'level' in parsedBody &&
            'category' in parsedBody &&
            'message' in parsedBody
          ) {
            const parsedBodyObj = parsedBody as {
              timestamp: unknown;
              level: unknown;
              category: unknown;
              message: unknown;
              data?: unknown;
            };

            // Extract data safely
            let extractedData: Record<string, unknown> | undefined;
            if (
              'data' in parsedBodyObj &&
              parsedBodyObj.data !== null &&
              typeof parsedBodyObj.data === 'object'
            ) {
              const data = parsedBodyObj.data;
              if (data && typeof data === 'object' && !Array.isArray(data)) {
                // Type guard to ensure data is a plain object
                const isPlainObject = (
                  obj: unknown,
                ): obj is Record<string, unknown> => {
                  return (
                    obj !== null &&
                    typeof obj === 'object' &&
                    !Array.isArray(obj) &&
                    Object.getPrototypeOf(obj) === Object.prototype
                  );
                };

                if (isPlainObject(data)) {
                  extractedData = data;
                }
              }
            }

            const entry: LogEntry = {
              timestamp: String(parsedBodyObj.timestamp),
              level: String(parsedBodyObj.level),
              category: String(parsedBodyObj.category),
              message: String(parsedBodyObj.message),
              data: extractedData,
            };
            const result = logAPI.handleLogRequest(entry);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          } else {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                success: false,
                message: 'Invalid log entry format',
              }),
            );
          }
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              success: false,
              message: 'Invalid log entry format',
            }),
          );
        }
      });
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
    }
  });

  const PORT = process.env.LOG_API_PORT || 3003;
  server.listen(PORT, () => {
    console.log(`Log API server running on port ${PORT}`);
    console.log(`Send POST requests to http://localhost:${PORT}/api/log`);
  });
}
