import { createHash } from 'node:crypto';
import process from 'node:process';
import svelte from '@astrojs/svelte';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import { clientViteConfig } from '../../scripts/client-build';

const vite = clientViteConfig();
export default defineConfig({
  site: 'https://www.georoids.com',
  output: 'static',
  cacheDir: './.performance/astro',
  trailingSlash: 'ignore',
  build: {
    format: 'directory',
    assets: `_vercel/immutable/${createHash('sha256')
      .update(process.env['VERCEL_HASH_SALT'] ?? 'georoids-local')
      .digest('hex')
      .slice(0, 24)}`,
  },
  server: { host: '127.0.0.1', port: vite.server.port },
  integrations: [svelte()],
  vite: { ...vite, plugins: [...vite.plugins, tailwindcss()] },
});
