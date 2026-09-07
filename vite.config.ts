import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  const define: Record<string, string> = {};

  // Inject build time
  define['import.meta.env.VITE_BUILD_TIME'] = JSON.stringify(new Date().toISOString());

  // Get the current git commit hash
  let commitHash = 'unknown';
  try {
    commitHash = execSync('git rev-parse --short HEAD', {
      encoding: 'utf8',
    }).trim();
  } catch (error) {
    console.warn('Could not get git commit hash:', error);
  }
  define['import.meta.env.VITE_COMMIT_HASH'] = JSON.stringify(commitHash);

  // VITE_WEBSOCKET_URL comes from .env.local (dev) or Vercel env (production).
  // Do not define it here — vite `define` overrides env and breaks production builds.

  return {
    resolve: {
      extensions: ['.ts'],
    },
    build: {
      target: 'esnext',
      modulePreload: false,
    },
    server: {
      port: 5173,
      strictPort: true, // Fail if port is not available
      proxy: {
        '/ws': {
          target: 'ws://localhost:3001',
          ws: true,
          changeOrigin: true,
          secure: false,
        },
        '/logs': {
          target: 'ws://localhost:3001',
          ws: true,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    define,
  };
});
