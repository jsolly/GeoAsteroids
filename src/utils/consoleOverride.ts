// Console override script - loads before all other modules
// This ensures logging filtering is active from the start

import { clearLogBuffer, copyLogs, getLogsAsText, setupConsoleOverride } from './logLevel.ts';

// Set up console overrides immediately when this script loads
setupConsoleOverride();

// Expose handy helpers for DevTools usage
// Now you can run `copyLogs()` in the console to copy all collected logs
(
  globalThis as unknown as {
    copyLogs?: () => Promise<void>;
    getLogsAsText?: () => string;
    clearLogBuffer?: () => void;
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
