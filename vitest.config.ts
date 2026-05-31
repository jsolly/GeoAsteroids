import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['tests/viteSetup.ts'],
    globals: true,
    testTimeout: 120000, // browser E2E scenarios (respawn cycles can exceed 60s under load)
    hookTimeout: 30000, // 30 seconds for hooks
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
