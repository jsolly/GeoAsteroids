#!/usr/bin/env node

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class LogServer {
  constructor(port = 3002) {
    this.port = port;
    // Create logs directory in project root
    this.logsDir = path.join(__dirname, '..', 'logs');
    this.logFile = path.join(this.logsDir, 'debug-logs.txt');
    this.errorLogFile = path.join(this.logsDir, 'error-logs.txt');
    this.ensureLogsDirectory();
    this.ensureLogFiles();
    this.startServer();
  }

  ensureLogsDirectory() {
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  ensureLogFiles() {
    if (!fs.existsSync(this.logFile)) {
      const header = `=== GeoAsteroids Debug Log ===
Started: ${new Date().toISOString()}
=====================================\n\n`;
      fs.writeFileSync(this.logFile, header);
    }

    if (!fs.existsSync(this.errorLogFile)) {
      const header = `=== GeoAsteroids Error Log ===
Started: ${new Date().toISOString()}
=====================================\n\n`;
      fs.writeFileSync(this.errorLogFile, header);
    }
  }

  writeLog(level, category, message, data = null) {
    const timestamp = new Date().toISOString();
    const dataStr = data ? ' ' + JSON.stringify(data, null, 2) : '';
    const logLine = `[${timestamp}] [${level}] [${category}] ${message}${dataStr}\n`;

    try {
      // Write to main debug log file
      fs.appendFileSync(this.logFile, logLine);

      // Also write warnings and errors to the error log file
      // Handle both string and numeric log levels
      const levelStr = String(level).toUpperCase();
      if (
        levelStr === 'WARN' ||
        levelStr === 'ERROR' ||
        levelStr === '2' ||
        levelStr === '3'
      ) {
        fs.appendFileSync(this.errorLogFile, logLine);
      }

      return true;
    } catch (error) {
      console.error('Failed to write to log file:', error);
      return false;
    }
  }

  startServer() {
    const server = http.createServer((req, res) => {
      // Add CORS headers for all requests
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader(
        'Access-Control-Allow-Methods',
        'GET, POST, DELETE, OPTIONS',
      );
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      // Handle preflight OPTIONS request
      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      if (req.method === 'POST' && req.url === '/log') {
        let body = '';
        req.on('data', (chunk) => {
          body += chunk.toString();
        });

        req.on('end', () => {
          try {
            const parsedBody = JSON.parse(body);
            if (
              typeof parsedBody === 'object' &&
              parsedBody !== null &&
              'timestamp' in parsedBody &&
              'level' in parsedBody &&
              'category' in parsedBody &&
              'message' in parsedBody
            ) {
              const entry = {
                timestamp: String(parsedBody.timestamp),
                level: String(parsedBody.level),
                category: String(parsedBody.category),
                message: String(parsedBody.message),
                data: 'data' in parsedBody ? parsedBody.data : undefined,
              };
              const success = this.writeLog(
                entry.level,
                entry.category,
                entry.message,
                entry.data,
              );

              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success, message: 'Log written' }));
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
      } else if (req.method === 'GET' && req.url === '/logs') {
        try {
          if (fs.existsSync(this.logFile)) {
            const content = fs.readFileSync(this.logFile, 'utf8');
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end(content);
          } else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('No log file found');
          }
        } catch {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Error reading logs');
        }
      } else if (req.method === 'GET' && req.url === '/error-logs') {
        try {
          if (fs.existsSync(this.errorLogFile)) {
            const content = fs.readFileSync(this.errorLogFile, 'utf8');
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end(content);
          } else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('No error log file found');
          }
        } catch {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Error reading error logs');
        }
      } else if (req.method === 'DELETE' && req.url === '/logs') {
        try {
          this.ensureLogFiles();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({ success: true, message: 'All logs cleared' }),
          );
        } catch {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({ success: false, message: 'Error clearing logs' }),
          );
        }
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
      }
    });

    server.listen(this.port, () => {
      console.log(`📝 Log server running on http://localhost:${this.port}`);
      console.log(`📁 Debug logs will be written to: ${this.logFile}`);
      console.log(`📁 Error logs will be written to: ${this.errorLogFile}`);
      console.log('Available endpoints:');
      console.log('  POST /log - Write a log entry');
      console.log('  GET /logs - View all logs');
      console.log('  GET /error-logs - View error logs only');
      console.log('  DELETE /logs - Clear all logs');
    });

    return server;
  }
}

// Start the server
const logServer = new LogServer(3002);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down log server...');
  process.exit(0);
});

export default logServer;
