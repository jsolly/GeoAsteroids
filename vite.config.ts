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

  // Set WebSocket URL for local development
  define['import.meta.env.VITE_WEBSOCKET_URL'] = JSON.stringify('ws://localhost:3001/ws');

  return {
    resolve: {
      extensions: ['.ts'],
    },
    build: {
      target: 'ESNext',
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
      },
    },
    define,
  };
});
