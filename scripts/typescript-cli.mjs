import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Frameworks import TypeScript 6's API; code checks explicitly select TypeScript 7's CLI.
export function nativeTypescriptCli() {
  return join(
    dirname(fileURLToPath(import.meta.resolve('@typescript/native/package.json'))),
    'bin/tsc'
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = spawnSync(process.execPath, [nativeTypescriptCli(), ...process.argv.slice(2)], {
    stdio: 'inherit',
  });
  if (result.error) {
    throw result.error;
  }
  if (result.signal) {
    process.kill(process.pid, result.signal);
  } else {
    process.exitCode = result.status ?? 1;
  }
}
