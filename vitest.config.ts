import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: 'test/setup/viteSetup.ts',
    pool: 'threads',
    sequence: { concurrent: true },
  },
  resolve: {
    extensions: ['.ts'],
  },
});
