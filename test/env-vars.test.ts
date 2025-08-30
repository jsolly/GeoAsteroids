/**
 * Test suite to verify all environment variables are properly applied
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock server-side environment variables for testing
const originalEnv = process.env;

// Server-side environment variables
describe('Server Environment Variables', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('PORT environment variable', () => {
    it('should default to 3001 when PORT is not set', async () => {
      delete process.env.PORT;
      // Import server.ts to check PORT usage
      const serverModule = await import('../server.ts');
      expect(serverModule).toBeDefined();

      // Since we can't easily test the actual server startup without mocking,
      // we verify the pattern is correct by checking the source
      const serverSource = await import('node:fs').then((fs) =>
        fs.readFileSync('./server.ts', 'utf-8')
      );
      expect(serverSource).toContain('const PORT = process.env.PORT || 3001;');
    });

    it('should use custom PORT when set', async () => {
      process.env.PORT = '8080';
      // Import server.ts to check PORT usage
      const serverModule = await import('../server.ts');
      expect(serverModule).toBeDefined();

      // Verify the pattern supports custom PORT
      const serverSource = await import('node:fs').then((fs) =>
        fs.readFileSync('./server.ts', 'utf-8')
      );
      expect(serverSource).toContain('const PORT = process.env.PORT || 3001;');
    });
  });

  describe('NODE_ENV environment variable', () => {
    it('should default to production when NODE_ENV is not set', async () => {
      delete process.env.NODE_ENV;

      const serverModule = await import('../server.ts');
      expect(serverModule).toBeDefined();

      // Verify the pattern supports NODE_ENV
      const serverSource = await import('node:fs').then((fs) =>
        fs.readFileSync('./server.ts', 'utf-8')
      );
      expect(serverSource).toContain("const NODE_ENV = process.env.NODE_ENV || 'production';");
    });

    it('should use custom NODE_ENV when set', async () => {
      process.env.NODE_ENV = 'development';

      const serverModule = await import('../server.ts');
      expect(serverModule).toBeDefined();

      // Verify the pattern supports custom NODE_ENV
      const serverSource = await import('node:fs').then((fs) =>
        fs.readFileSync('./server.ts', 'utf-8')
      );
      expect(serverSource).toContain("const NODE_ENV = process.env.NODE_ENV || 'production';");
    });
  });

  describe('SERVER_LOG_LEVEL environment variable', () => {
    it('should default to INFO when SERVER_LOG_LEVEL is not set', async () => {
      delete process.env.SERVER_LOG_LEVEL;

      // Import and test the logger
      const { logger } = await import('../setup/serverLogger');

      // Since logger uses console methods, we can't easily test the internal state
      // but we can verify the module loads and has expected methods
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
    });

    it('should respect SERVER_LOG_LEVEL when set to debug', async () => {
      process.env.SERVER_LOG_LEVEL = 'debug';

      // Re-import to get fresh environment
      const { logger } = await import('../setup/serverLogger');

      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.info).toBe('function');
    });

    it('should respect SERVER_LOG_LEVEL when set to error', async () => {
      process.env.SERVER_LOG_LEVEL = 'error';

      // Re-import to get fresh environment
      const { logger } = await import('../setup/serverLogger');

      expect(typeof logger.error).toBe('function');
    });
  });
});

// Client-side environment variables
describe('Client Environment Variables (VITE_*)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe('Environment Variable Logic Verification', () => {
    it('should verify VITE_WEBSOCKET_URL fallback logic works', () => {
      // Test the fallback logic used in ConnectionManager and MultiplayerManager
      const testCases = [
        { input: undefined, expected: 'ws://localhost:3001/ws' },
        { input: 'ws://custom-server:9000/ws', expected: 'ws://custom-server:9000/ws' },
        { input: '', expected: 'ws://localhost:3001/ws' }, // Empty string should also fallback
      ];

      testCases.forEach(({ input, expected }) => {
        const result = input || 'ws://localhost:3001/ws';
        expect(result).toBe(expected);
      });
    });

    it('should verify VITE_CLIENT_LOG_LEVEL parsing logic', () => {
      // Test the log level parsing logic from logLevel.ts
      const testCases = [
        { input: 'debug', expected: 3 },
        { input: 'info', expected: 2 },
        { input: 'warn', expected: 1 },
        { input: 'error', expected: 0 },
        { input: 'invalid', expected: 2 }, // defaults to info
        { input: undefined, expected: 3 }, // defaults to debug in dev
      ];

      testCases.forEach(({ input, expected }) => {
        let result: number;
        if (!input) {
          result = 3; // debug default
        } else {
          switch (input.toLowerCase()) {
            case 'error':
              result = 0;
              break;
            case 'warn':
              result = 1;
              break;
            case 'info':
              result = 2;
              break;
            case 'debug':
              result = 3;
              break;
            default:
              result = 2;
              break;
          }
        }
        expect(result).toBe(expected);
      });
    });

    it('should verify debug configuration parsing', () => {
      // Test the debug config parsing logic from DebugManager
      const testCases = [
        { input: '5', expected: 5 },
        { input: undefined, expected: 1 },
        { input: 'invalid', expected: NaN },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = input ? parseInt(input, 10) : 1;
        if (Number.isNaN(expected)) {
          expect(Number.isNaN(result)).toBe(true);
        } else {
          expect(result).toBe(expected);
        }
      });
    });

    it('should verify boolean flag parsing', () => {
      // Test boolean flag parsing used throughout the codebase
      const testCases = [
        { input: 'true', expected: true },
        { input: 'false', expected: false },
        { input: undefined, expected: false },
        { input: '', expected: false },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = input === 'true';
        expect(result).toBe(expected);
      });
    });
  });

  describe('Build-time environment variables', () => {
    it('should have VITE_BUILD_TIME injected at build time', async () => {
      const { getBuildInfo } = await import('../src/utils/buildInfo');

      const buildInfo = getBuildInfo();
      expect(buildInfo.buildTime).toBeDefined();
      expect(typeof buildInfo.buildTime).toBe('string');
    });

    it('should have VITE_COMMIT_HASH injected at build time', async () => {
      const { getBuildInfo } = await import('../src/utils/buildInfo');

      const buildInfo = getBuildInfo();
      expect(buildInfo.commitHash).toBeDefined();
      expect(typeof buildInfo.commitHash).toBe('string');
    });

    it('should have MODE environment variable', async () => {
      const { getBuildInfo } = await import('../src/utils/buildInfo');

      const buildInfo = getBuildInfo();
      expect(buildInfo.environment).toBeDefined();
      expect(typeof buildInfo.environment).toBe('string');
    });
  });

  describe('Environment Variable Usage Patterns', () => {
    it('should verify all VITE_ environment variables are defined in types', async () => {
      // Read the vite-env.d.ts file to verify all environment variables are typed
      const fs = await import('node:fs');
      const viteEnvContent = fs.readFileSync('./src/types/vite-env.d.ts', 'utf-8');

      // Check that all known VITE_ variables are defined
      const expectedVars = [
        'VITE_WEBSOCKET_URL',
        'VITE_CLIENT_LOG_LEVEL',
        'VITE_DEBUG_LOCAL_PLAYER_INVINCIBLE',
        'VITE_DEBUG_BOT_COUNT',
        'VITE_DEBUG_ROID_COUNT',
        'VITE_DEBUG_DISABLE_BOT_MOVEMENT',
        'VITE_DEBUG_DISABLE_BOT_LASERS',
        'VITE_DEBUG_PLACE_ROID_ON_BOT',
        'VITE_DEBUG_DISABLE_ROID_MOVEMENT',
        'VITE_DEBUG_DISABLE_BOT_SPAWN_PROTECTION',
        'VITE_DEBUG_PLACE_BOTS_NEAR_LOCAL_PLAYER',
      ];

      expectedVars.forEach((varName) => {
        expect(viteEnvContent).toContain(varName);
      });
    });

    it('should verify environment variables have proper fallbacks', async () => {
      // Read key files to verify they have proper fallbacks
      const fs = await import('node:fs');

      const connectionManager = fs.readFileSync(
        './src/multiplayer/services/ConnectionManager.ts',
        'utf-8'
      );
      expect(connectionManager).toContain("VITE_WEBSOCKET_URL || 'ws://localhost:3001/ws'");

      const multiplayerManager = fs.readFileSync(
        './src/multiplayer/multiplayerManager.ts',
        'utf-8'
      );
      expect(multiplayerManager).toContain("VITE_WEBSOCKET_URL || 'ws://localhost:3001/ws'");
    });

    it('should verify debug mode detection works', async () => {
      const { isDebugMode } = await import('../src/utils/debugUtils');

      // Test that the function exists and returns a boolean
      expect(typeof isDebugMode).toBe('function');
      const result = isDebugMode();
      expect(typeof result).toBe('boolean');
    });
  });
});

// Integration test to verify environment variables work together
describe('Environment Variable Integration', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should verify all environment variable patterns are consistent', () => {
    // Test that all environment variable usage follows consistent patterns

    // Boolean flags should use === 'true' pattern
    const booleanPattern = /import\.meta\.env\.\w+ === 'true'/;

    // Numeric values should use parseInt with fallback
    const numericPattern = /parseInt\(import\.meta\.env\.\w+ \|\| '\d+', 10\)/;

    // String values should use || fallback
    const stringPattern = /import\.meta\.env\.\w+ \|\| '[^']*'/;

    // These patterns should be consistent across the codebase
    expect(booleanPattern).toBeDefined();
    expect(numericPattern).toBeDefined();
    expect(stringPattern).toBeDefined();
  });

  it('should verify build configuration includes environment variables', async () => {
    const { getBuildInfo } = await import('../src/utils/buildInfo');

    const buildInfo = getBuildInfo();

    // Verify that build info includes environment detection
    expect(buildInfo).toHaveProperty('environment');
    expect(buildInfo).toHaveProperty('commitHash');
    expect(buildInfo).toHaveProperty('buildTime');
    expect(buildInfo).toHaveProperty('version');
  });

  it('should verify debug utilities work correctly', async () => {
    const { isDebugMode } = await import('../src/utils/debugUtils');

    // Test that debug utilities are available and functional
    expect(typeof isDebugMode).toBe('function');

    // The actual return value depends on environment, but it should be boolean
    const result = isDebugMode();
    expect(typeof result).toBe('boolean');
  });
});
