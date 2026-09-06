import { expect, test } from 'vitest';
import { publishHarpoonField } from '../../../src/entities/ship/harpoonField';
import {
  canDrawHaulerHarpoon,
  drawHaulerHarpoonVfx,
  harpoonTetherStyle,
} from '../../../src/entities/ship/shipRenderer';
import { HAULER_TETHER_COLOR, HAULER_TETHER_TIP_COLOR } from '../../../src/entities/ship/shipKits';
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

test('PASS bar cream line and amber tip are exact hex', () => {
  expect(HAULER_TETHER_COLOR).toBe('#E8D5A3');
  expect(HAULER_TETHER_TIP_COLOR).toBe('#FDE68A');
});

test('short zoomed tethers stay solid and thicken under playfield zoom', () => {
  expect(harpoonTetherStyle(8).dash).toEqual([]);
  expect(harpoonTetherStyle(8).ring).toBeGreaterThanOrEqual(14);
  expect(harpoonTetherStyle(80).dash).toEqual([8, 5]);
  expect(harpoonTetherStyle(80, 0.25).lineWidth).toBeGreaterThan(harpoonTetherStyle(80, 1).lineWidth);
  expect(harpoonTetherStyle(80, 1).lineWidth).toBeGreaterThanOrEqual(4);
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

function paintRecorder(): { ctx: CanvasRenderingContext2D; strokes: string[]; fills: string[] } {
  const strokes: string[] = [];
  const fills: string[] = [];
  const state = {
    strokeStyle: '',
    fillStyle: '',
    shadowColor: '',
    shadowBlur: 0,
    lineWidth: 0,
  };
  const ctx = {
    get strokeStyle() {
      return state.strokeStyle;
    },
    set strokeStyle(value: string) {
      state.strokeStyle = value;
    },
    get fillStyle() {
      return state.fillStyle;
    },
    set fillStyle(value: string) {
      state.fillStyle = value;
    },
    get shadowColor() {
      return state.shadowColor;
    },
    set shadowColor(value: string) {
      state.shadowColor = value;
    },
    get shadowBlur() {
      return state.shadowBlur;
    },
    set shadowBlur(value: number) {
      state.shadowBlur = value;
    },
    get lineWidth() {
      return state.lineWidth;
    },
    set lineWidth(value: number) {
      state.lineWidth = value;
    },
    save: () => undefined,
    restore: () => undefined,
    beginPath: () => undefined,
    moveTo: () => undefined,
    lineTo: () => undefined,
    arc: () => undefined,
    setLineDash: () => undefined,
    stroke() {
      strokes.push(state.strokeStyle);
    },
    fill() {
      fills.push(state.fillStyle);
    },
  } as unknown as CanvasRenderingContext2D;
  return { ctx, strokes, fills };
}

test('tether VFX still resolves a server asteroid id suffix', () => {
  publishHarpoonField([
    { id: 'server-asteroid-10', position: { x: 40, y: 0 }, velocity: { x: 0, y: 0 } },
  ]);
  const hauler = new Ship({ kitId: 'hauler' });
  hauler.harpoonTimer = 40;
  hauler.harpoonTargetId = 'asteroid-10';
  const { ctx, strokes, fills } = paintRecorder();
  drawHaulerHarpoonVfx(ctx, hauler, 0, 0, { x: 0, y: 0 });
  expect(strokes).toContain('#E8D5A3');
  expect(fills).toContain('#FDE68A');
});

test('Hauler latch paints opaque cream line and amber tip', () => {
  publishHarpoonField([{ id: 'rock-1', position: { x: 40, y: 0 }, velocity: { x: 0, y: 0 } }]);
  const hauler = new Ship({ kitId: 'hauler' });
  hauler.harpoonTimer = 40;
  hauler.harpoonTargetId = 'rock-1';
  const { ctx, strokes, fills } = paintRecorder();
  drawHaulerHarpoonVfx(ctx, hauler, 0, 0, { x: 0, y: 0 });
  expect(strokes).toContain('#E8D5A3');
  expect(strokes).toContain('#FDE68A');
  expect(fills).toContain('#FDE68A');
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
    fill: () => calls.push('fill'),
    setLineDash: () => calls.push('setLineDash'),
  } as unknown as CanvasRenderingContext2D;
  publishHarpoonField([{ id: 'rock-1', position: { x: 40, y: 0 }, velocity: { x: 0, y: 0 } }]);
  const dart = new Ship({ kitId: 'dart' });
  dart.harpoonTimer = 40;
  dart.harpoonTargetId = 'rock-1';
  drawHaulerHarpoonVfx(ctx, dart, 0, 0, { x: 0, y: 0 });
  expect(calls).toEqual([]);
});
