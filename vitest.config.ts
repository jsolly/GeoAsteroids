import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['lcov', ['text', { skipFull: true }]],
      exclude: [
        'src/asteroidsCanv.ts',
        'src/lasersCanv.ts',
        'src/shipCanv.ts',
        'src/canvas.ts',
        'src/eventLoop.ts',
        'src/config.ts',
        'src/logger.ts',
        'test/**',
      ],
    },
    environment: 'jsdom',
    threads: false,
    setupFiles: 'setup/viteSetup.ts',
  },
});
