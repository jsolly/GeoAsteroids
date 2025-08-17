#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class LogWriter {
  constructor() {
    // Create logs directory in project root
    this.logsDir = path.join(__dirname, '..', 'logs');
    this.logFile = path.join(this.logsDir, 'debug-logs.txt');
    this.ensureLogsDirectory();
    this.ensureLogFile();
    console.log(
      `📝 Log writer initialized. Logs will be written to: ${this.logFile}`,
    );
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
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  clearLogs() {
    try {
      this.ensureLogFile();
      console.log('Logs cleared');
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  }

  showLogs() {
    try {
      if (fs.existsSync(this.logFile)) {
        const content = fs.readFileSync(this.logFile, 'utf8');
        console.log('\n=== Current Logs ===');
        console.log(content);
        console.log('=== End Logs ===\n');
      } else {
        console.log('No log file found');
      }
    } catch (error) {
      console.error('Failed to read logs:', error);
    }
  }
}

// Create singleton instance
const logWriter = new LogWriter();

// Handle command line arguments
const args = process.argv.slice(2);
if (args.length > 0) {
  const command = args[0];
  switch (command) {
    case 'clear':
      logWriter.clearLogs();
      break;
    case 'show':
      logWriter.showLogs();
      break;
    case 'help':
      console.log('Available commands:');
      console.log('  clear - Clear all logs');
      console.log('  show  - Show current logs');
      console.log('  help  - Show this help');
      break;
    default:
      console.log(`Unknown command: ${command}`);
      console.log('Use "help" to see available commands');
  }
} else {
  console.log('Log writer running. Use Ctrl+C to stop.');
  console.log('Commands: clear, show, help');
}

// Export for use in other scripts
export default logWriter;
