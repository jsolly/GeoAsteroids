import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['tests/viteSetup.ts'],
    globals: true,
    testTimeout: 120000, // browser E2E scenarios (respawn cycles can exceed 60s under load)
    hookTimeout: 30000, // 30 seconds for hooks
    // Browser E2E tests drive a real game loop over WebSockets and are subject
    // to timing jitter under load in the long single-process suite. Retry to
    // absorb transient flakes; deterministic unit tests pass on the first
    // attempt and are unaffected.
    retry: 2,
    env: {
      VITEST: 'true',
      NODE_ENV: 'test',
    },
    // CRITICAL: Prevent multiple Vitest instances to avoid rate limiting
    pool: 'forks', // Use separate processes instead of threads
    poolOptions: {
      forks: {
        singleFork: true, // Run all tests in a single fork - CRITICAL for rate limiting
      },
    },
    // Force sequential execution to prevent multiple browser instances
    sequence: {
      concurrent: false, // Run tests one at a time
    },
    // Additional safeguards
    maxConcurrency: 1, // Only allow 1 concurrent test
    // Prevent parallel test execution
    isolate: true, // Isolate each test file
    // Ensure tests run in order
    fileParallelism: false, // Disable file-level parallelism
  },
  resolve: {
    extensions: ['.ts'],
  },
});
