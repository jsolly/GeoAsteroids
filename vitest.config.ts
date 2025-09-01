import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: 'tests/viteSetup.ts',
    include: ['tests/**/*.test.ts'],
    globals: true,
  },
  resolve: {
    extensions: ['.ts'],
  },
});
