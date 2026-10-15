// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

const script = fileURLToPath(new URL('../../../scripts/compare-frame-work.ts', import.meta.url));
const witness = { before: { state: 'before' }, after: { state: 'after' } };

async function compare(
  directory: string,
  name: string,
  baselineWitness: object,
  candidateWitness: object = baselineWitness
) {
  const output = join(directory, `${name}-comparison.json`);
  const args = ['--import', 'tsx', script, '--output', output];
  const sources: Array<{ path: string; sha256: string; git: Record<string, string> }> = [];
  for (const [arm, strokes, outcome] of [
    ['baseline', 8, baselineWitness],
    ['candidate', 4, candidateWitness],
  ] as const) {
    for (const observation of [0, 1]) {
      const path = join(directory, `${name}-${arm}-${observation}.json`);
      const git = {
        sourceSha256: (arm === 'baseline' ? 'a' : 'b').repeat(64),
        productSha256: (arm === 'baseline' ? 'c' : 'd').repeat(64),
        harnessSha256: 'e'.repeat(64),
        lockfileSha256: 'f'.repeat(64),
      };
      // Synthetic parser inputs: distinct timing observations, identical work and outcomes per arm.
      const raw = JSON.stringify({
        kind: 'frame-work',
        metadata: { git, environment: { fixture: 'code-only parser input' } },
        result: {
          cleanup: 'complete',
          samples: {
            frameIntervalMs: Array.from({ length: 120 }, () => 16 + observation / 100),
          },
          frameImageSha256: '0'.repeat(64),
          frameWork: Array.from({ length: 120 }, () => ({
            'update.calls': 1,
            'render.calls': 1,
            'render.canvas.stroke': strokes,
          })),
          counts: {
            'update.calls': 120,
            'render.calls': 120,
            'render.canvas.stroke': strokes * 120,
          },
          witness: outcome,
          parameters: { seed: 42, measuredFrames: 120, viewport: 'touch-portrait' },
        },
      });
      await writeFile(path, raw);
      sources.push({ path, sha256: createHash('sha256').update(raw).digest('hex'), git });
      args.push(`--${arm}`, path);
    }
  }
  return {
    output,
    sources,
    child: spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 30_000 }),
  };
}

test('a frame-work comparison retains observed outcomes and a literal work delta', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'frame-work-outcome-'));
  try {
    const { child, output, sources } = await compare(directory, 'observed', witness);
    expect(child.error).toBeUndefined();
    expect(child.signal).toBeNull();
    expect(child.status).toBe(0);
    const result = JSON.parse(await readFile(output, 'utf8'));
    expect(result).toMatchObject({
      exactRepeats: true,
      sameGameOutcome: true,
      sameFinalFramePixels: true,
      changes: {
        'render.canvas.stroke': { baselinePerFrame: 8, candidatePerFrame: 4, deltaPerFrame: -4 },
      },
    });
    expect(result.sources).toEqual(sources);
    expect(new Set(sources.map((source) => source.sha256)).size).toBe(4);
    expect(result.interpretation).toContain(
      'not weighted CPU cost or proof of faster presentation'
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('missing or empty game outcomes cannot be reported as matching observations', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'frame-work-outcome-'));
  try {
    const rows = [
      { name: 'missing-both', value: {}, error: 'Missing before game outcome witness' },
      {
        name: 'missing-before',
        value: { after: witness.after },
        error: 'Missing before game outcome witness',
      },
      {
        name: 'missing-after',
        value: { before: witness.before },
        error: 'Missing after game outcome witness',
      },
      {
        name: 'empty-before',
        value: { before: {}, after: witness.after },
        error: 'Missing before game outcome witness',
      },
      {
        name: 'empty-after',
        value: { before: witness.before, after: {} },
        error: 'Missing after game outcome witness',
      },
      {
        name: 'changed-outcome',
        value: witness,
        candidate: { before: witness.before, after: { state: 'changed' } },
        error: 'Game outcome changed',
      },
    ];
    const outcomes: Array<{
      name: string;
      status: number | null;
      signal: NodeJS.Signals | null;
      error: string | null;
      reportedSameOutcome: unknown;
      expectedRejection: boolean;
    }> = [];
    for (const row of rows) {
      const { child, output } = await compare(directory, row.name, row.value, row.candidate);
      const published = existsSync(output) ? JSON.parse(await readFile(output, 'utf8')) : null;
      outcomes.push({
        name: row.name,
        status: child.status,
        signal: child.signal,
        error: child.error?.message ?? null,
        reportedSameOutcome: published?.sameGameOutcome ?? null,
        expectedRejection: child.stderr.includes(row.error),
      });
    }
    expect(outcomes, JSON.stringify(outcomes)).toEqual(
      rows.map((row) => ({
        name: row.name,
        status: 1,
        signal: null,
        error: null,
        reportedSameOutcome: null,
        expectedRejection: true,
      }))
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
