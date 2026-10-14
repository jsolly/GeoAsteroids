import { expect, test, vi } from 'vitest';
import { drawRemainsMark } from '../../../src/rendering/remainsRenderer';

test('wrecks and nest ruins draw distinct broken ribs without a filled hull', () => {
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) {
    throw new Error('Canvas required');
  }
  const lines = vi.spyOn(ctx, 'lineTo');
  const fills = vi.spyOn(ctx, 'fill');
  drawRemainsMark(ctx, 50, 50, 10, false);
  expect(lines).toHaveBeenCalledTimes(3);
  lines.mockClear();
  drawRemainsMark(ctx, 50, 50, 10, true);
  expect(lines).toHaveBeenCalledTimes(6);
  expect(fills).not.toHaveBeenCalled();
  vi.restoreAllMocks();
});
