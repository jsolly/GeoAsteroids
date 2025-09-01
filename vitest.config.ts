import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: 'test/setup/viteSetup.ts',
  },
  resolve: {
    extensions: ['.ts'],
  },
});
