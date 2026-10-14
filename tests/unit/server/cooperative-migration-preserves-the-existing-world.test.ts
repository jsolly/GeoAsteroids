/* @vitest-environment node */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, expect, test } from 'vitest';
import {
  legacyWorldDigest,
  migrateCooperativeWorld,
  readCooperativeWorld,
} from '../../../server/world/cooperativeSchema';
import { WorkerWorldPersistence } from '../../../server/world/WorkerWorldPersistence';
import { WorldStore } from '../../../server/world/WorldStore';
import { CIVIC_LOTS } from '../../../shared/furnaces';
import { WORLD } from '../../../shared/world';

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) {
    cleanup();
  }
});
function legacyFixture() {
  const dir = mkdtempSync(join(tmpdir(), 'georoids-cooperative-'));
  cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'world.sqlite');
  const store = new WorldStore(path);
  store.checkpoint(
    {
      seed: 83,
      generation: WORLD.generation,
      startedAt: 10_000,
      exploration: [],
      civicModules: CIVIC_LOTS.map((lot) => ({ id: lot.id, builderName: 'Crew' })),
    },
    new Map(),
    [
      {
        id: 'pilot',
        name: 'Captain',
        tokenHash: 'a'.repeat(64),
        score: 7300,
        cargo: 715,
        purchases: [],
      },
    ]
  );
  store.close();
  const db = new DatabaseSync(path);
  cleanups.push(() => db.close());
  return { path, db };
}

test('additive migration preserves exact legacy rows, stays inactive and reruns safely', () => {
  const { db, path } = legacyFixture();
  const digest = legacyWorldDigest(db);
  expect(readCooperativeWorld(db)).toBeUndefined();
  migrateCooperativeWorld(db, digest);
  migrateCooperativeWorld(db, digest);
  expect(legacyWorldDigest(db)).toBe(digest);
  expect(readCooperativeWorld(db)).toEqual({ schemaVersion: 1, activated: false, records: [] });
  const store = new WorldStore(path);
  try {
    expect(store.load().pilots[0]).toMatchObject({ cargo: 715, score: 7300 });
    expect(() =>
      store.checkpoint(undefined, new Map(), [], undefined, {
        records: [{ kind: 'project', id: 'deep-scanner', deliveredValue: 20, completedAt: null }],
        removed: [],
      })
    ).toThrow('not activated');
  } finally {
    store.close();
  }
});

test('a changed precondition or partial migration refuses without changing legacy progress', () => {
  const { db } = legacyFixture();
  const digest = legacyWorldDigest(db);
  expect(() => migrateCooperativeWorld(db, 'wrong')).toThrow('changed');
  expect(readCooperativeWorld(db)).toBeUndefined();
  db.exec(
    'CREATE TABLE cooperative_schema(version INTEGER,activated INTEGER); INSERT INTO cooperative_schema VALUES(2,0);'
  );
  expect(() => migrateCooperativeWorld(db, digest)).toThrow('Incomplete');
  expect(legacyWorldDigest(db)).toBe(digest);
  expect(db.isTransaction).toBe(false);
});

test('campaign progress and pilot credit commit atomically and invalid rows never replace them', () => {
  const { db, path } = legacyFixture();
  migrateCooperativeWorld(db, legacyWorldDigest(db));
  db.exec('UPDATE cooperative_schema SET activated=1');
  const store = new WorldStore(path);
  try {
    const pilot = store.loadPilots()[0];
    if (!pilot) {
      throw new Error('Missing fixture pilot');
    }
    store.checkpoint(undefined, new Map(), [{ ...pilot, score: 7500 }], undefined, {
      records: [{ kind: 'project', id: 'deep-scanner', deliveredValue: 200, completedAt: null }],
      removed: [],
    });
    expect(store.load().cooperative?.records[0]).toMatchObject({ deliveredValue: 200 });
    db.exec(
      "CREATE TRIGGER reject_pilot BEFORE INSERT ON pilots BEGIN SELECT RAISE(ABORT, 'fixture failure'); END;"
    );
    expect(() =>
      store.checkpoint(undefined, new Map(), [{ ...pilot, score: 7900 }], undefined, {
        records: [{ kind: 'project', id: 'deep-scanner', deliveredValue: 600, completedAt: null }],
        removed: [],
      })
    ).toThrow('fixture failure');
    expect(store.load().cooperative?.records[0]).toMatchObject({ deliveredValue: 200 });
    expect(store.loadPilots()[0]?.score).toBe(7500);
    db.exec("UPDATE cooperative_records SET json='{}'");
    expect(() => store.load()).toThrow('Invalid cooperative record');
  } finally {
    store.close();
  }
});

test('CLI dry run is read-only, backup is exact and activation requires its current receipt', () => {
  const { path, db } = legacyFixture();
  const digest = legacyWorldDigest(db);
  const cli = (...args: string[]) =>
    execFileSync(
      process.execPath,
      ['--import', 'tsx', 'scripts/migrate-cooperative-world.ts', ...args],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    );
  expect(JSON.parse(cli('dry-run', path)).cooperative).toBeNull();
  expect(readCooperativeWorld(db)).toBeUndefined();
  const backupPath = join(path, '..', 'backup.sqlite');
  expect(JSON.parse(cli('apply', path, digest, backupPath))).toMatchObject({
    legacyRowsPreserved: true,
    cooperative: { activated: false },
  });
  const backup = new DatabaseSync(backupPath, { readOnly: true });
  try {
    expect(legacyWorldDigest(backup)).toBe(digest);
    expect(readCooperativeWorld(backup)).toBeUndefined();
  } finally {
    backup.close();
  }
  expect(() => cli('activate', path, 'stale')).toThrow();
  expect(readCooperativeWorld(db)?.activated).toBe(false);
  expect(JSON.parse(cli('activate', path, digest)).cooperative.activated).toBe(true);
  expect(legacyWorldDigest(db)).toBe(digest);
});

test('worker commits campaign and pilot changes atomically and restores them after restart', async () => {
  const { path, db } = legacyFixture();
  migrateCooperativeWorld(db, legacyWorldDigest(db));
  db.exec('UPDATE cooperative_schema SET activated=1');
  const writer = new WorkerWorldPersistence(path);
  const loaded = writer.load();
  const pilot = loaded.pilots[0];
  if (!pilot) {
    throw new Error('Pilot missing');
  }
  try {
    writer.persist({
      sectors: new Map(),
      pilots: [{ ...pilot, score: 8000 }],
      cooperative: {
        records: [{ kind: 'project', id: 'deep-scanner', deliveredValue: 800, completedAt: null }],
        removed: [],
      },
    });
    await writer.whenIdle();
  } finally {
    await writer.shutdown();
  }
  const restarted = new WorkerWorldPersistence(path);
  try {
    const saved = restarted.load();
    expect(saved.pilots[0]?.score).toBe(8000);
    expect(saved.cooperative?.records).toEqual([
      { kind: 'project', id: 'deep-scanner', deliveredValue: 800, completedAt: null },
    ]);
  } finally {
    await restarted.shutdown();
  }
});
