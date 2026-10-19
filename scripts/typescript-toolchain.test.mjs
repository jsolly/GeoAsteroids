import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import { test } from 'vitest';
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

test('Vite applies compiler policy only to selected project inputs', async () => {
  const sourceRoot = fileURLToPath(new URL('../', import.meta.url));
  const require = createRequire(join(sourceRoot, 'package.json'));
  const astroRequire = createRequire(require.resolve('astro/package.json'));
  const viteRequire = createRequire(astroRequire.resolve('vite/package.json'));
  const { transformWithOxc } = await import(pathToFileURL(viteRequire.resolve('vite')).href);
  const { resolveTsconfig } = await import(
    pathToFileURL(viteRequire.resolve('rolldown/experimental')).href
  );
  const { TsconfigCache } = await import(pathToFileURL(viteRequire.resolve('rolldown/utils')).href);
  const parent = realpathSync(mkdtempSync(join(tmpdir(), 'georoids-native-policy-')));
  const root = join(parent, 'project');
  const source = 'import { unused } from "/src/dependency.ts"; export const marker: number = 17;';
  function put(name, body) {
    const path = join(root, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, body);
    return path;
  }
  function owner(path) {
    const result = resolveTsconfig(path, new TsconfigCache());
    if (result === null) {
      return null;
    }
    assert(result && typeof result === 'object' && 'tsconfigFilePaths' in result);
    assert(Array.isArray(result.tsconfigFilePaths));
    assert.equal(typeof result.tsconfigFilePaths[0], 'string');
    return result.tsconfigFilePaths[0];
  }
  async function emitted(path) {
    const result = await transformWithOxc(source, path);
    assert.equal(typeof result.code, 'string');
    return result.code;
  }
  try {
    for (const name of ['tsconfig.json', 'config/typescript/tsconfig.json']) {
      put(name, readFileSync(join(sourceRoot, name)));
    }
    put('package.json', '{"type":"module"}');
    symlinkSync(join(sourceRoot, 'node_modules'), join(root, 'node_modules'), 'dir');
    put(
      'src/dependency.ts',
      'export const unused = 17; globalThis[Symbol.for("config-proof")] = true;'
    );
    put(
      'src/nested/tsconfig.json',
      JSON.stringify({
        compilerOptions: { verbatimModuleSyntax: false },
        include: ['owned.ts', 'excluded.ts'],
        exclude: ['excluded.ts'],
      })
    );
    for (const name of [
      'src/probe.ts',
      'tests/probe.ts',
      'scripts/probe.ts',
      'server/probe.ts',
      'shared/probe.ts',
      'setup/probe.ts',
      'server.ts',
      'shared-types.ts',
      'config/app/astro.ts',
      'config/testing/vitest.ts',
      'src/nested/fallback.ts',
      'src/nested/excluded.ts',
    ]) {
      const path = put(name, source);
      assert.equal(owner(path), join(root, 'tsconfig.json'), name);
      assert((await emitted(path)).includes('dependency.ts'), name);
    }
    const nested = put('src/nested/owned.ts', source);
    assert.equal(owner(nested), join(root, 'src/nested/tsconfig.json'));
    assert(!(await emitted(nested)).includes('dependency.ts'));
    const outside = join(parent, 'outside.ts');
    writeFileSync(outside, source);
    for (const path of [
      ...[
        '.railway/probe.ts',
        'dist/probe.ts',
        'benchmarks/probe.ts',
        'config/typescript/probe.ts',
        'config/app/unrelated.ts',
        'config/testing/unrelated.ts',
        'root-probe.ts',
      ].map((name) => put(name, source)),
      outside,
    ]) {
      assert.equal(owner(path), null, path);
      assert(!(await emitted(path)).includes('dependency.ts'), path);
    }
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});
