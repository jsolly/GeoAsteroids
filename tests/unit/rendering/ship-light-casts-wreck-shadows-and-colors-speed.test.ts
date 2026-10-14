import { expect, test, vi } from 'vitest';
import { isAsteroidLit } from '../../../shared/glowtoy';
import { validateAsteroidDto } from '../../../shared/snapshotDto';
import { Roid } from '../../../src/entities/roid/Roid';
import { applyAsteroidKinematics } from '../../../src/network/services/asteroidFieldSync';
import { drawEngineLight, drawHeadlight } from '../../../src/rendering/shipLighting';
import { snapshotFixture } from '../network/snapshotFixture';

test('only wrecks in the forward cone cast clipped shadows', () => {
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) {
    throw new Error('Canvas required');
  }
  const fill = vi.spyOn(ctx, 'fill');
  const clip = vi.spyOn(ctx, 'clip');
  drawHeadlight(ctx, { x: 0, y: 0 }, 0, 1, [
    { x: 100, y: 0 },
    { x: -100, y: 0 },
    { x: 100, y: 400 },
  ]);
  expect(clip).toHaveBeenCalledOnce();
  expect(fill).toHaveBeenCalledOnce();
  vi.restoreAllMocks();
});

test('engine light shifts its emitted color and reach at contour speed', () => {
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) {
    throw new Error('Canvas required');
  }
  const stops = vi.fn();
  vi.spyOn(ctx, 'createRadialGradient').mockReturnValue({ addColorStop: stops });
  const shapes = vi.spyOn(ctx, 'ellipse');
  drawEngineLight(ctx, { x: 10, y: 10 }, 0, 20, false, 100);
  const ordinary = shapes.mock.calls[0]?.[2];
  expect(stops).toHaveBeenCalledWith(0, 'rgba(95,204,245,0.16)');
  drawEngineLight(ctx, { x: 10, y: 10 }, 0, 20, true, 100);
  expect(shapes.mock.calls[1]?.[2]).toBeGreaterThan(ordinary ?? 0);
  expect(stops).toHaveBeenCalledWith(0, 'rgba(179,123,255,0.24)');
  vi.restoreAllMocks();
});

test('authoritative glow metadata survives DTO and client application', () => {
  const row = snapshotFixture().asteroids[0];
  if (!row) {
    throw new Error('Missing fixture asteroid');
  }
  row.glowtoy = { charge: 0, cachePosition: { x: 600, y: 0 }, cacheRevealed: false };
  validateAsteroidDto(row);
  const client = new Roid(row);
  applyAsteroidKinematics(client, row);
  expect(isAsteroidLit(client)).toBe(false);
  applyAsteroidKinematics(client, { ...row, glowtoy: { ...row.glowtoy, charge: 0.8 } });
  expect(client.glowtoy?.cachePosition).toEqual({ x: 600, y: 0 });
  expect(isAsteroidLit(client)).toBe(true);
  expect(() =>
    validateAsteroidDto({ ...row, glowtoy: { ...row.glowtoy, charge: Infinity } })
  ).toThrow();
});
