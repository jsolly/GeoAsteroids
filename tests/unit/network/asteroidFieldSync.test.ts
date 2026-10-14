import { afterEach, expect, test } from 'vitest';
import { WORLD } from '../../../shared/world';

import type { AsteroidData, AsteroidDestroyEvent } from '../../../shared-types';
import { Roid } from '../../../src/entities/roid/Roid';
import {
  applyAsteroidFieldPartition,
  applyAsteroidKinematics,
  bindAsteroidFieldApply,
  createAsteroidFieldSyncScratch,
  notifyAsteroidDestroyed,
  partitionAsteroidSnapshot,
  readAsteroidBelt,
  shouldSnapAsteroidPose,
  unbindAsteroidFieldApply,
} from '../../../src/network/services/asteroidFieldSync';
import { asteroidRow } from '../../support/asteroid-row';

const row = (id: string, x = 0, y = 0): AsteroidData => ({
  ...asteroidRow({ x, y }, 20, id),
  velocity: { x: 1, y: 0 },
});
afterEach(unbindAsteroidFieldApply);

test('first snapshot creates every complete row without inventing belt membership', () => {
  const belt: Roid[] = [];
  const result = partitionAsteroidSnapshot([row('a'), row('b')], belt);
  expect(result.created.map((rock) => rock.id)).toEqual(['a', 'b']);
  expect(result.updated).toEqual([]);
  expect(result.removed).toEqual([]);
  expect(belt).toEqual([]);
});

test('create, update and eviction follow current belt even when a caller replaces it directly', () => {
  const belt = [new Roid(row('a')), new Roid(row('gone'))];
  const result = partitionAsteroidSnapshot(
    [row('a', 80, -12), row('fresh')],
    belt,
    undefined,
    true
  );
  expect(result.created.map((rock) => rock.id)).toEqual(['fresh']);
  expect(result.updated.map((rock) => rock.id)).toEqual(['a']);
  expect(result.removed).toEqual(['gone']);
  belt.length = 0;
  expect(partitionAsteroidSnapshot([row('a')], belt).created).toHaveLength(1);
});

test('fragment batches preserve unrelated belt rows; only complete snapshots evict', () => {
  const belt = [new Roid(row('nearby')), new Roid(row('parent'))];
  const batch = partitionAsteroidSnapshot([row('fragment')], belt);
  expect(batch.created.map((rock) => rock.id)).toEqual(['fragment']);
  expect(batch.removed).toEqual([]);
  expect(partitionAsteroidSnapshot([], belt).removed).toEqual([]);
  expect(partitionAsteroidSnapshot([row('nearby')], belt, undefined, true).removed).toEqual([
    'parent',
  ]);
});

test('partition reuses arrays and derived membership sets on every steady-state snapshot', () => {
  const belt = [new Roid(row('a'))];
  const scratch = createAsteroidFieldSyncScratch();
  const ids = scratch.snapshotIds;
  const localIds = scratch.localIds;
  for (let tick = 0; tick < 120; tick++) {
    const result = partitionAsteroidSnapshot([row('a', tick), row('b')], belt, scratch, true);
    expect(result).toBe(scratch);
    expect(result.created).toBe(scratch.created);
    expect(result.updated).toBe(scratch.updated);
    expect(result.removed).toBe(scratch.removed);
    expect(scratch.snapshotIds).toBe(ids);
    expect(scratch.localIds).toBe(localIds);
    expect(result.created.map((rock) => rock.id)).toEqual(['b']);
    expect(result.updated.map((rock) => rock.id)).toEqual(['a']);
  }
});

test('complete construction preserves ore, surveys and shape without random defaults', () => {
  const source = {
    ...row('fragment'),
    ore: 'metal' as const,
    surveyedBy: ['scout'],
    material: 'ice' as const,
  };
  const rock = new Roid(source);
  expect(rock.ore).toBe('metal');
  expect(rock.surveyedBy).toEqual(['scout']);
  expect(rock.material).toBe('ice');
  expect(rock.offsets).toEqual(source.offsets);
  expect(rock.offsets).not.toBe(source.offsets);
  expect(rock.position).not.toBe(source.position);
});

test('small pose drift remains interpolated while velocity follows authority', () => {
  const local = new Roid(row('a', 10, 10));
  const source = { ...row('a', 14, 10), velocity: { x: 2, y: 0 } };
  applyAsteroidKinematics(local, source);
  expect(local.position).toEqual({ x: 10, y: 10 });
  expect(local.velocity).toEqual({ x: 2, y: 0 });
  expect(shouldSnapAsteroidPose(local.position, source.position)).toBe(false);
});

test('large drift snaps in place and keeps vector identity', () => {
  const local = new Roid(row('a', 1, 2));
  const position = local.position,
    velocity = local.velocity;
  applyAsteroidKinematics(local, row('a', 80, -12));
  expect(local.position).toBe(position);
  expect(local.velocity).toBe(velocity);
  expect(position).toEqual({ x: 80, y: -12 });
});

test('an escaped interpolated pose is contained even when server drift is small', () => {
  const radius = WORLD.radius;
  const local = new Roid(row('a', radius + 1000, 40));
  applyAsteroidKinematics(local, row('a', radius + 1005, 40));
  expect(Math.hypot(local.position.x, local.position.y)).toBeLessThanOrEqual(radius);
  expect(local.position.y / local.position.x).toBeCloseTo(40 / (radius + 1005), 10);
});

test('complete rows copy live reflection, mining and probe metadata and clear omitted metadata', () => {
  const source: AsteroidData = {
    ...row('a'),
    surveyedBy: ['scout'],
    miningContributors: ['miner'],
    phenomenon: { kind: 'reflective', clusterId: 'cluster', energy: 2, maxEnergy: 6 },
    probe: {
      id: 'probe',
      ownerId: 'scout',
      health: 40,
      maxHealth: 40,
      attachedAt: 1000,
      expiresAt: 301000,
      angle: 0,
      radialOffset: 40,
    },
  };
  const local = new Roid(row('a'));
  applyAsteroidKinematics(local, source);
  expect(local.phenomenon).toEqual(source.phenomenon);
  expect(local.miningContributors).toEqual(['miner']);
  expect(local.surveyedBy).toEqual(['scout']);
  expect(local.probe).toEqual(source.probe);
  if (!source.probe) {
    throw new Error('Missing probe fixture');
  }
  source.probe.health = 1;
  expect(local.probe?.health).toBe(40);
  applyAsteroidKinematics(local, row('a'));
  expect(local.probe).toBeNull();
  expect(local.boost).toBeNull();
  expect(local.surveyedBy).toBeUndefined();
  expect(local.miningContributors).toBeUndefined();
});

test('reconciliation removes rows without triggering destruction effects', () => {
  const reconciled: string[] = [],
    destroyed: AsteroidDestroyEvent[] = [];
  const belt = [new Roid(row('replaced'))];
  bindAsteroidFieldApply({
    readBelt: () => belt,
    onCreated: () => {},
    onUpdated: () => {},
    onDestroyed: (event) => destroyed.push(event),
    onReconciled: (id) => reconciled.push(id),
  });
  expect(readAsteroidBelt()).toBe(belt);
  applyAsteroidFieldPartition(partitionAsteroidSnapshot([], belt, undefined, true));
  notifyAsteroidDestroyed({ asteroidId: 'destroyed' });
  expect(reconciled).toEqual(['replaced']);
  expect(destroyed).toEqual([{ asteroidId: 'destroyed' }]);
});

test('complete rows copy campaign and glow metadata, then clear it after reconnecting to an older server', () => {
  const source = {
    ...row('glow'),
    glowtoy: { charge: 0.8, cachePosition: { x: 200, y: 0 }, cacheRevealed: false },
    contourRider: { height: 0, direction: 1 as const },
    supply: { sourceId: 'furnace:1', value: 25 },
  };
  const rock = new Roid(source);
  expect(rock.glowtoy).toEqual(source.glowtoy);
  expect(rock.glowtoy).not.toBe(source.glowtoy);
  expect(rock.contourRider).toEqual(source.contourRider);
  expect(rock.supply).toEqual(source.supply);
  applyAsteroidKinematics(rock, { ...source, health: 20 });
  expect(rock.glowtoy?.charge).toBe(0.8);
  expect(rock.contourRider?.height).toBe(0);
  expect(rock.supply).not.toBe(source.supply);
  applyAsteroidKinematics(rock, row('glow'));
  expect(rock.glowtoy).toBeUndefined();
  expect(rock.contourRider).toBeUndefined();
  expect(rock.supply).toBeUndefined();
});
