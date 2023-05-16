import { defineConfig } from 'vitest/config';
import ssr from 'vite-plugin-ssr/plugin';

export default defineConfig({
  plugins: [ssr()],
  test: {
    environment: 'jsdom',
    threads: false,
    setupFiles: 'setup/viteSetup.ts',
  },
});
