/* @vitest-environment node */
import { expect, test } from 'vitest';
import { RolyPolyManager } from '../../../server/core/RolyPolyManager';
import { ROLY_POLY } from '../../../shared/rolyPoly';
import { validateSnapshotDto } from '../../../shared/snapshotDto';
import { WORLD } from '../../../shared/world';
import { GameServerWorld } from '../scenarios/support/gameServerWorld';

const pilotAt = (x: number, y: number) => ({
  position: { x, y },
  velocity: { x: 1, y: 0 },
  health: 100,
  exploding: false,
  radius: 20,
});

test('a neutral animal curls at an approaching pilot, rolls when nudged, then resumes walking without damaging the pilot', () => {
  const manager = new RolyPolyManager();
  const pilot = pilotAt(0, 0);
  manager.advance([pilot], 1);
  const animal = manager.snapshot()[0];
  if (!animal) {
    throw new Error('Expected occupied habitat');
  }
  const id = animal.id;
  pilot.position = { x: animal.position.x + 80, y: animal.position.y };
  manager.advance([pilot], 2);
  expect(manager.snapshot().find((row) => row.id === id)).toMatchObject({
    phase: 'curled',
    velocity: { x: 0, y: 0 },
  });
  pilot.position = { ...animal.position };
  manager.advance([pilot], 3);
  const rolling = manager.snapshot().find((row) => row.id === id);
  expect(rolling?.phase).toBe('rolling');
  expect(Math.hypot(rolling?.velocity.x ?? 0, rolling?.velocity.y ?? 0)).toBeCloseTo(
    ROLY_POLY.rollSpeed
  );
  expect(pilot.health).toBe(100);
  pilot.position = { x: animal.position.x + 400, y: animal.position.y };
  manager.advance([pilot], 3 + ROLY_POLY.rollFrames);
  expect(manager.snapshot().find((row) => row.id === id)?.phase).toBe('walking');
  animal.position.x = Infinity;
  expect(manager.snapshot().every((row) => Number.isFinite(row.position.x))).toBe(true);
});

test('only visited habitats exist, with a fixed total budget and no population after the last pilot leaves', () => {
  const manager = new RolyPolyManager();
  const pilots = Array.from({ length: 100 }, (_, i) => pilotAt(i * 800, i * 600));
  manager.advance(pilots, 1);
  expect(manager.snapshot().length).toBeGreaterThan(0);
  expect(manager.snapshot().length).toBeLessThanOrEqual(ROLY_POLY.maximumActive);
  expect(
    manager.snapshot().every((row) => Math.hypot(row.position.x, row.position.y) < WORLD.radius)
  ).toBe(true);
  manager.advance([], 60);
  expect(manager.snapshot()).toEqual([]);
});

test('the real server sends nearby wildlife through snapshot validation and excludes remote habitats', () => {
  const world = new GameServerWorld();
  try {
    const near = world.join('Near', { x: 0, y: 0 });
    const far = world.join('Far', { x: 0, y: 0 });
    world.entity(far).position = { x: 20000, y: 20000 };
    world.engine.advanceOneFrame();
    world.broadcastGameState();
    const snapshot = world.snapshot(near);
    validateSnapshotDto(snapshot);
    expect(snapshot.rolyPolys?.length).toBeGreaterThan(0);
    const ids = new Set(snapshot.rolyPolys?.map((row) => row.id));
    expect(world.snapshot(far).rolyPolys?.some((row) => ids.has(row.id))).toBe(false);
    expect(() =>
      validateSnapshotDto({
        ...snapshot,
        rolyPolys: [{ ...snapshot.rolyPolys?.[0], phase: 'attacking' }],
      })
    ).toThrow();
  } finally {
    world.dispose();
  }
});
