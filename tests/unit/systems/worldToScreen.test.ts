import { expect, test } from 'vitest';

import { canvasManager } from '../../../src/rendering/canvas';

test('worldToScreenInto writes into the provided object and returns it', () => {
  const out = { x: 1, y: 2 };
  const result = canvasManager.worldToScreenInto(out, { x: 10, y: 20 }, { x: 3, y: 4 });
  expect(result).toBe(out);
  expect(out).toEqual({ x: 7, y: 16 });
});
