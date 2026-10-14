import { expect, test } from 'vitest';
import { AsteroidManager } from '../../../server/core/AsteroidManager';
import { RNGService } from '../../../server/core/RNGService';
import { stepAsteroidMotion } from '../../../shared/asteroidMotion';
import { partitionAsteroidSnapshot } from '../../../src/network/services/asteroidFieldSync';
import { drawingOffsets, projectWorldToScreenInto } from '../../../src/rendering/playfieldCamera';

test('nearby rocks project inside the close view and an approaching rock crosses its edge', () => {
  const viewport = { width: 800, height: 600 };
  const onCanvas = (world: { x: number; y: number }) => {
    const screen = projectWorldToScreenInto({ x: 0, y: 0 }, world, ship, viewport);
    return (
      screen.x >= 0 && screen.x <= viewport.width && screen.y >= 0 && screen.y <= viewport.height
    );
  };
  const ship = { x: 0, y: 0 };
  const nearby = { position: { x: 100, y: -40 } };
  const distant = { position: { x: 900, y: 0 } };
  const approaching = { position: { x: 401, y: 0 } };
  expect(onCanvas(nearby.position)).toBe(true);
  expect(onCanvas(distant.position)).toBe(false);
  expect(onCanvas(approaching.position)).toBe(false);

  approaching.position = stepAsteroidMotion(approaching.position, { x: -2, y: 0 }).position;

  expect(approaching.position).toEqual({ x: 399, y: 0 });
  expect(onCanvas(approaching.position)).toBe(true);
});

test('two clients retain the identified asteroid rows from the same server snapshot', () => {
  const manager = new AsteroidManager(new RNGService(3));
  manager.createAsteroids(12);
  const payload = manager.getAllAsteroids();
  const expectedIds = payload.map((rock) => rock.id);
  expect(expectedIds).toHaveLength(12);
  const a = partitionAsteroidSnapshot(payload, []);
  const b = partitionAsteroidSnapshot(payload, []);
  expect(a.created.map((rock) => rock.id)).toEqual(expectedIds);
  expect(b.created.map((rock) => rock.id)).toEqual(expectedIds);
  expect(a.removed).toEqual([]);
  expect(b.removed).toEqual([]);
});

test('asteroid outlines reuse supplied offsets and share a circular fallback for empty shapes', () => {
  const offsets = [1.1, 0.9];
  expect(drawingOffsets(offsets)).toBe(offsets);
  expect(drawingOffsets([])).toEqual([1]);
  expect(drawingOffsets([])).toBe(drawingOffsets([]));
});
