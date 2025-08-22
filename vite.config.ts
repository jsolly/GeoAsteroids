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

  return {
    resolve: {
      extensions: ['.ts', '.js', '.tsx', '.jsx'],
    },
    build: {
      target: 'ESNext',
      modulePreload: false,
    },
    define,
  };
});
