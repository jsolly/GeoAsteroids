const config = {
  $schema: '../../node_modules/knip/schema.json',
  // These files are invoked by Railway/Vite/Vitest or discovered dynamically by
  // the shell runners, so package.json alone cannot describe every entrypoint.
  entry: [
    'server.ts',
    'server/world/worldStoreWorker.ts',
    'server/debugReports/worker.ts',
    '.railway/**/*.ts',
    'scripts/**/*.ts',
    'src/pages/**/*.astro',
    'benchmarks/client.html',
    'benchmarks/protocol-experiment.ts',
    'benchmarks/realtime-server.ts',
    'benchmarks/sample.ts',
    'benchmarks/realtime-client.ts',
    'benchmarks/load.ts',
    'tests/**/*.test.ts',
  ],
  project: [
    'benchmarks/**/*.ts',
    'src/**/*.{ts,tsx,svelte,astro,css}',
    'server/**/*.ts',
    'shared/**/*.ts',
    'shared-types.ts',
    'setup/**/*.ts',
    '.railway/**/*.ts',
    'scripts/**/*.ts',
    'tests/**/*.ts',
    'vitest*.config.ts',
    'config/app/**/*.ts',
    'config/testing/**/*.ts',
  ],
  // These dependencies are executed by shell scripts, CI, or deployment
  // tooling; Knip cannot infer those non-TypeScript consumers.
  // afconvert is the macOS system encoder used by sounds:generate.
  ignoreBinaries: ['uvx', 'afconvert'],
  ignoreDependencies: [
    'concurrently',
    'markdownlint-cli2',
    'jsonc-parser',
    'shadcn-svelte',
    'ts-prune',
  ],
  astro: { config: ['astro.config.ts', 'config/app/astro.ts'] },
  svelte: { config: ['svelte.config.js', 'config/app/svelte.js'] },
  vitest: { config: ['vitest.config.ts', 'config/testing/vitest.ts'] },
};

export default config;
