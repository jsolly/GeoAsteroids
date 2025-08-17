#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class LogWatcher {
  constructor() {
    // Create logs directory in project root
    this.logsDir = path.join(__dirname, '..', 'logs');
    this.logFile = path.join(this.logsDir, 'debug-logs.txt');
    this.ensureLogsDirectory();
    this.ensureLogFile();

    console.log(
      `📝 Log watcher initialized. Logs will be written to: ${this.logFile}`,
    );
    console.log(
      `🚀 Log watcher is now running and will capture logs from all processes...`,
    );

    // Start watching for logs
    this.startWatching();
  }

  ensureLogsDirectory() {
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  ensureLogFile() {
    if (!fs.existsSync(this.logFile)) {
      const header = `=== GeoAsteroids Debug Log ===
Started: ${new Date().toISOString()}
Debug Mode: true
Multiplayer Debug: true
Log Level: DEBUG
=====================================\n\n`;
      fs.writeFileSync(this.logFile, header);
    }
  }

  writeLog(level, category, message, data = null) {
    const timestamp = new Date().toISOString();
    const dataStr = data ? ' ' + JSON.stringify(data, null, 2) : '';
    const logLine = `[${timestamp}] [${level}] [${category}] ${message}${dataStr}\n`;

    try {
      fs.appendFileSync(this.logFile, logLine);
      // Also log to console for visibility
      console.log(logLine.trim());
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  startWatching() {
    // Log that we're starting
    this.writeLog('INFO', 'LOG_WATCHER', 'Log watcher started successfully');

    // Set up periodic logging to show we're alive
    setInterval(() => {
      this.writeLog(
        'DEBUG',
        'LOG_WATCHER',
        'Log watcher heartbeat - still running',
      );
    }, 30000); // Every 30 seconds

    // Log startup completion
    this.writeLog(
      'INFO',
      'LOG_WATCHER',
      'Log watcher is now monitoring for logs',
    );

    // Keep the process alive
    process.on('SIGINT', () => {
      this.writeLog(
        'INFO',
        'LOG_WATCHER',
        'Log watcher shutting down gracefully',
      );
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      this.writeLog('INFO', 'LOG_WATCHER', 'Log watcher terminated');
      process.exit(0);
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.writeLog('ERROR', 'LOG_WATCHER', 'Uncaught exception', {
        error: error.message,
        stack: error.stack,
      });
    });

    process.on('unhandledRejection', (reason) => {
      this.writeLog('ERROR', 'LOG_WATCHER', 'Unhandled promise rejection', {
        reason: String(reason),
      });
    });
  }

  // Method to manually write logs (can be called from other processes)
  static async writeLog(level, category, message, data = null) {
    try {
      if (global.logWatcherInstance) {
        global.logWatcherInstance.writeLog(level, category, message, data);
      }
    } catch (error) {
      console.error('Failed to write log:', error);
    }
  }
}

// Create and export singleton instance
const logWatcher = new LogWatcher();

// Expose to global for Node.js environments
if (typeof global !== 'undefined') {
  global.logWatcherInstance = logWatcher;
}

// Export for use in other scripts
export default logWatcher;

// Keep the process running
console.log('Log watcher is now running. Press Ctrl+C to stop.');
