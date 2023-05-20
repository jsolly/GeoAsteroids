import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'c8',
      reporter: ['lcov', 'text'],
    },
    environment: 'jsdom',
    threads: false,
    setupFiles: 'setup/viteSetup.ts',
  },
});
