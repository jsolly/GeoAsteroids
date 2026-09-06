import { expect, test } from 'vitest';
import type { AsteroidData } from '../../../shared-types';
import {
  applyAsteroidKinematics,
  asteroidKinematicUpdates,
  partitionAsteroidSnapshot,
  shouldSnapAsteroidPose,
} from '../../../src/network/services/asteroidFieldSync';

function roid(id: string, x: number, y: number): AsteroidData {
  return {
    id,
    position: { x, y },
    velocity: { x: 1, y: 0 },
    size: 20,
    jaggedness: 0.5,
    rotation: 0,
    angularVelocity: 0,
    health: 10,
    maxHealth: 10,
    vertices: 8,
    offsets: [1, 1, 1, 1, 1, 1, 1, 1],
  };
}

test('first snapshot creates every asteroid and records the ids', () => {
  const seen = new Set<string>();
  const { created, updated } = partitionAsteroidSnapshot(
    [roid('server-asteroid-0', 1, 2), roid('server-asteroid-1', 3, 4)],
    seen
  );

  expect(created.map((asteroid) => asteroid.id)).toEqual([
    'server-asteroid-0',
    'server-asteroid-1',
  ]);
  expect(updated).toEqual([]);
  expect(seen.size).toBe(2);
});

test('a later snapshot updates known asteroids so a late joiner can share the live field', () => {
  const seen = new Set(['server-asteroid-0']);
  const live = roid('server-asteroid-0', 80, -12);
  const fresh = roid('server-asteroid-2', 0, 0);
  const { created, updated } = partitionAsteroidSnapshot([live, fresh], seen);

  expect(created.map((asteroid) => asteroid.id)).toEqual(['server-asteroid-2']);
  expect(updated).toEqual([live]);
  expect(asteroidKinematicUpdates(live).position).toEqual({ x: 80, y: -12 });
  expect(seen.has('server-asteroid-2')).toBe(true);
});

test('a duplicate create still writes the live pose onto the existing roid', () => {
  const local = {
    position: { x: 1, y: 2 },
    velocity: { x: 0, y: 0 },
    angle: 0,
    angularVelocity: 0,
    health: 10,
    maxHealth: 10,
    r: 20,
  };
  applyAsteroidKinematics(local, roid('server-asteroid-0', 80, -12), { snapPosition: true });
  expect(local.position).toEqual({ x: 80, y: -12 });
  expect(local.velocity).toEqual({ x: 1, y: 0 });
});

test('small pose error keeps the interpolated position so the field does not hitch', () => {
  const local = {
    position: { x: 10, y: 10 },
    velocity: { x: 1, y: 0 },
    angle: 0,
    angularVelocity: 0,
    health: 10,
    maxHealth: 10,
    r: 20,
  };
  applyAsteroidKinematics(local, {
    position: { x: 14, y: 10 },
    velocity: { x: 2, y: 0 },
  });
  expect(shouldSnapAsteroidPose({ x: 10, y: 10 }, { x: 14, y: 10 })).toBe(false);
  expect(local.position).toEqual({ x: 10, y: 10 });
  expect(local.velocity).toEqual({ x: 2, y: 0 });
});

test('a large pose error snaps so a late joiner shares the live field', () => {
  const local = {
    position: { x: 1, y: 2 },
    velocity: { x: 0, y: 0 },
    angle: 0,
    angularVelocity: 0,
    health: 10,
    maxHealth: 10,
    r: 20,
  };
  applyAsteroidKinematics(local, roid('server-asteroid-0', 80, -12));
  expect(local.position).toEqual({ x: 80, y: -12 });
});
