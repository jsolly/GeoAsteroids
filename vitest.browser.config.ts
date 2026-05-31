import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from './vitest.config';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: ['tests/integration/browser/**/*.test.ts'],
      testTimeout: 120_000,
      hookTimeout: 90_000,
    },
  })
);
