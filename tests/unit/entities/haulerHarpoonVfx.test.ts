import { expect, test } from 'vitest';
import { publishHarpoonField } from '../../../src/entities/ship/harpoonField';
import { canDrawHaulerHarpoon, drawHaulerHarpoonVfx } from '../../../src/entities/ship/shipRenderer';
import { Ship } from '../../../src/entities/ship/Ship';

test('tether VFX is Hauler-only while latched', () => {
  expect(
    canDrawHaulerHarpoon({ kitId: 'hauler', harpoonTimer: 40, harpoonTargetId: 'rock-1' })
  ).toBe(true);
  expect(canDrawHaulerHarpoon({ kitId: 'dart', harpoonTimer: 40, harpoonTargetId: 'rock-1' })).toBe(
    false
  );
  expect(canDrawHaulerHarpoon({ kitId: 'hauler', harpoonTimer: 0, harpoonTargetId: 'rock-1' })).toBe(
    false
  );
  expect(canDrawHaulerHarpoon({ kitId: 'hauler', harpoonTimer: 40 })).toBe(false);
});

test('tether VFX can resolve a latched ship from the shared field', () => {
  publishHarpoonField([
    {
      id: 'bob',
      position: { x: 80, y: 0 },
      velocity: { x: 0, y: 0 },
      kind: 'ship',
      health: 100,
    },
  ]);
  expect(
    canDrawHaulerHarpoon({ kitId: 'hauler', harpoonTimer: 40, harpoonTargetId: 'bob' })
  ).toBe(true);
});

test('non-Hauler draw is a no-op even if a latch is spoofed', () => {
  const calls: string[] = [];
  const ctx = {
    save: () => calls.push('save'),
    restore: () => calls.push('restore'),
    beginPath: () => calls.push('beginPath'),
    moveTo: () => calls.push('moveTo'),
    lineTo: () => calls.push('lineTo'),
    arc: () => calls.push('arc'),
    stroke: () => calls.push('stroke'),
    setLineDash: () => calls.push('setLineDash'),
  } as unknown as CanvasRenderingContext2D;
  publishHarpoonField([{ id: 'rock-1', position: { x: 40, y: 0 }, velocity: { x: 0, y: 0 } }]);
  const dart = new Ship({ kitId: 'dart' });
  dart.harpoonTimer = 40;
  dart.harpoonTargetId = 'rock-1';
  drawHaulerHarpoonVfx(ctx, dart, 0, 0, { x: 0, y: 0 });
  expect(calls).toEqual([]);
});
