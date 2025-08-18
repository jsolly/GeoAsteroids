// Console override script - loads before all other modules
// This ensures logging filtering is active from the start

import { setupConsoleOverride } from './logLevel.ts';

// Set up console overrides immediately when this script loads
setupConsoleOverride();

// Log that the override is active (this will respect the log level)
console.info('CONSOLE_OVERRIDE', 'Console override initialized successfully');
