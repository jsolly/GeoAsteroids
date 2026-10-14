import { afterEach, expect, test, vi } from 'vitest';
import { PALETTE, VISUAL } from '../../../src/constants';
import { Ship } from '../../../src/entities/ship/Ship';
import { drawShipAtPosition } from '../../../src/entities/ship/shipRenderer';
import { canvasManager } from '../../../src/rendering/canvasSurface';
import { TestPath2D } from '../../support/TestPath2D';

afterEach(() => {
  canvasManager.destroy();
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test('crew health remains visible through damage, repair and protected blinking', () => {
  const canvas = document.createElement('canvas');
  document.body.append(canvas);
  vi.stubGlobal('Path2D', TestPath2D);
  canvasManager.initialize(canvas);
  const ctx = canvasManager.requireContext();
  const ship = new Ship({ position: { x: 0, y: 0 }, color: '#fff' });
  ship.isLocalPlayer = false;
  const healthSegments: number[] = [];
  let start = 0;
  let end = 0;
  vi.spyOn(ctx, 'moveTo').mockImplementation((x) => {
    start = x;
  });
  vi.spyOn(ctx, 'lineTo').mockImplementation((x) => {
    end = x;
  });
  vi.spyOn(ctx, 'stroke').mockImplementation(() => {
    if (
      ctx.strokeStyle === PALETTE.HEALTH.toLowerCase() &&
      ctx.lineWidth === VISUAL.HEALTH_CAPSULE_HEIGHT
    ) {
      healthSegments.push(end - start);
    }
  });
  for (const fraction of [1, 0.5, 1]) {
    ship.health = ship.maxHealth * fraction;
    drawShipAtPosition(ship, { x: 0, y: 0 });
  }
  expect(healthSegments).toHaveLength(3);
  expect(healthSegments[1]).toBeCloseTo((healthSegments[0] ?? 0) / 2);
  expect(healthSegments[2]).toBe(healthSegments[0]);
  ship.blinkCount = 2;
  ship.blinkOn = false;
  drawShipAtPosition(ship, { x: 0, y: 0 });
  expect(healthSegments).toHaveLength(4);
  ship.health = 0;
  drawShipAtPosition(ship, { x: 0, y: 0 });
  expect(healthSegments).toHaveLength(4);
});
