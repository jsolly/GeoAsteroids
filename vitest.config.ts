import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: 'test/setup/viteSetup.ts',
    env: {
      VITE_CLIENT_LOG_LEVEL: 'warn',
    },
  },
  resolve: {
    extensions: ['.ts', '.js', '.tsx', '.jsx'],
  },
});
