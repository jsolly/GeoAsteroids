import { expect, test, vi } from 'vitest';
import type { RolyPolyState } from '../../../shared-types';
import { drawRolyPoly } from '../../../src/rendering/rolyPolyRenderer';

test('wildlife renders legs while walking and a coil while curled', () => {
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) {
    throw new Error('Canvas required');
  }
  const animal: RolyPolyState = {
    id: 'roly-poly:0,0',
    position: { x: 50, y: 50 },
    velocity: { x: 0.15, y: 0 },
    phase: 'walking',
  };
  const lines = vi.spyOn(ctx, 'lineTo');
  const arcs = vi.spyOn(ctx, 'arc');
  drawRolyPoly(ctx, animal, animal.position, 16, 100);
  expect(lines).toHaveBeenCalledTimes(15);
  expect(arcs).not.toHaveBeenCalled();
  lines.mockClear();
  drawRolyPoly(ctx, { ...animal, phase: 'curled' }, animal.position, 16, 100);
  expect(lines).not.toHaveBeenCalled();
  expect(arcs).toHaveBeenCalledTimes(2);
  vi.restoreAllMocks();
});
