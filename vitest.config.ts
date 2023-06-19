import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'c8',
      reporter: ['lcov', 'text'],
      exclude: [
        'src/asteroidsCanv.ts',
        'src/lasersCanv.ts',
        'src/shipCanv.ts',
        'src/canvas.ts',
        'test/**',
      ],
    },
    environment: 'jsdom',
    threads: false,
    setupFiles: 'setup/viteSetup.ts',
  },
});
