// Console override script - loads before all other modules
// This ensures logging filtering is active from the start

import { startClientLogForwarder } from './logForwarder';
import { clearLogBuffer, copyLogs, getLogsAsText, setupConsoleOverride } from './logLevel';

// Set up console overrides immediately when this script loads
setupConsoleOverride();

// Optionally forward client logs to server for local file capture
// Automatically enabled in development mode
if (import.meta.env?.DEV === true || import.meta.env?.MODE === 'development') {
  try {
    startClientLogForwarder();
  } catch (error) {
    console.warn('LOG_FORWARD', 'Failed to start client log forwarder', { error });
  }
}

// Expose handy helpers for DevTools usage
// Now you can run `copyLogs()` in the console to copy all collected logs
(
  globalThis as unknown as {
    copyLogs?: () => Promise<void>;
    getLogsAsText?: () => string;
    clearLogBuffer?: () => void;
    startClientLogForwarder?: () => void;
  }
).copyLogs = () => copyLogs();

(
  globalThis as unknown as {
    getLogsAsText?: () => string;
  }
).getLogsAsText = () => getLogsAsText();

(
  globalThis as unknown as {
    clearLogBuffer?: () => void;
  }
).clearLogBuffer = () => clearLogBuffer();

// Expose manual starter for log forwarding
(
  globalThis as unknown as {
    startClientLogForwarder?: () => void;
  }
).startClientLogForwarder = () => startClientLogForwarder();
