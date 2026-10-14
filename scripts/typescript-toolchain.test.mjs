import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { nativeTypescriptCli } from './typescript-cli.mjs';

const launcher = fileURLToPath(new URL('./typescript-cli.mjs', import.meta.url));

test('framework compiler APIs remain TypeScript 6 while code checks execute TypeScript 7', () => {
  const compatibility = JSON.parse(
    readFileSync(new URL(import.meta.resolve('typescript/package.json')))
  );
  assert.equal(compatibility.name, '@typescript/typescript6');
  assert.match(compatibility.version, /^6\./u);
  assert.match(ts.version, /^6\./u);
  assert.equal(typeof ts.resolveModuleName, 'function');
  assert.equal(typeof ts.readConfigFile, 'function');
  assert.equal(typeof ts.parseJsonConfigFileContent, 'function');
  const root = fileURLToPath(new URL('../', import.meta.url));
  for (const framework of ['@astrojs/check', '@astrojs/svelte', 'svelte-check', 'svelte2tsx']) {
    const require = createRequire(join(root, 'node_modules', framework, 'package.json'));
    const frameworkCompiler = require('typescript');
    assert.equal(
      frameworkCompiler.version,
      ts.version,
      `${framework} must resolve the supported API`
    );
    assert.equal(frameworkCompiler.resolveModuleName, ts.resolveModuleName);
  }
  const native = JSON.parse(readFileSync(join(dirname(nativeTypescriptCli()), '../package.json')));
  assert.equal(native.name, 'typescript');
  assert.match(native.version, /^7\./u);
  const result = spawnSync(process.execPath, [launcher, '--version'], { encoding: 'utf8' });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), `Version ${native.version}`);
});

test('the explicit native compiler accepts valid code and rejects a real type error', () => {
  const directory = mkdtempSync(join(tmpdir(), 'georoids-typescript-toolchain-'));
  try {
    // The compatibility package also installs an old `tsc` binary. Never depend on .bin ordering.
    writeFileSync(join(directory, 'tsc'), '#!/bin/sh\nexit 88\n', { mode: 0o755 });
    writeFileSync(
      join(directory, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          strict: true,
          noEmit: true,
          types: [],
          lib: ['ESNext'],
          skipLibCheck: true,
        },
        files: ['case.ts'],
      })
    );
    const run = () =>
      spawnSync(process.execPath, [launcher, '--project', directory, '--pretty', 'false'], {
        cwd: directory,
        encoding: 'utf8',
        env: { ...process.env, PATH: `${directory}:${process.env.PATH ?? ''}` },
      });
    writeFileSync(join(directory, 'case.ts'), 'const value: number = 1;\n');
    const clean = run();
    assert.ifError(clean.error);
    assert.equal(clean.status, 0, clean.stdout + clean.stderr);
    writeFileSync(join(directory, 'case.ts'), 'const value: number = "wrong";\n');
    const invalid = run();
    assert.ifError(invalid.error);
    assert.notEqual(invalid.status, 0);
    assert.match(invalid.stdout, /error TS2322/u);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
