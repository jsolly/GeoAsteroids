import { afterEach, expect, test, vi } from 'vitest';
import { publishHarpoonField } from '../../../src/entities/ship/harpoonField';
import { Ship } from '../../../src/entities/ship/Ship';
import { drawHaulerHarpoonVfx, harpoonTetherStyle } from '../../../src/entities/ship/shipRenderer';
import { canvasManager } from '../../../src/rendering/canvasSurface';

afterEach(() => {
  publishHarpoonField([]);
  vi.restoreAllMocks();
});

test('tethers stay solid and hairline in screen space at every zoom', () => {
  expect(harpoonTetherStyle().dash).toEqual([]);
  expect(harpoonTetherStyle().lineWidth).toBe(1.5);
  expect(harpoonTetherStyle().tipRadius).toBe(3.5);
});

function paintRecorder(): {
  ctx: CanvasRenderingContext2D;
  strokes: string[];
  fills: string[];
  strokeWidths: number[];
  arcRadii: number[];
  arcCenters: number[][];
  lines: number[][];
} {
  const strokes: string[] = [];
  const fills: string[] = [];
  const strokeWidths: number[] = [];
  const arcRadii: number[] = [];
  const arcCenters: number[][] = [];
  const lines: number[][] = [];
  let pen = { x: 0, y: 0 };
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
    moveTo: (x: number, y: number) => {
      pen = { x, y };
    },
    lineTo: (x: number, y: number) => {
      lines.push([pen.x, pen.y, x, y]);
      pen = { x, y };
    },
    arc: (...args: unknown[]) => {
      const [x, y, radius] = args;
      if (typeof radius === 'number') {
        arcRadii.push(radius);
      }
      if (typeof x === 'number' && typeof y === 'number') {
        arcCenters.push([x, y]);
      }
    },
    setLineDash: () => undefined,
    stroke() {
      strokes.push(state.strokeStyle);
      strokeWidths.push(state.lineWidth);
    },
    fill() {
      fills.push(state.fillStyle);
    },
  } as unknown as CanvasRenderingContext2D;
  return { ctx, strokes, fills, strokeWidths, arcRadii, arcCenters, lines };
}

test('tether VFX resolves the exact server asteroid id', () => {
  const distractor = {
    id: 'other-rock',
    position: { x: -40, y: 70 },
    velocity: { x: 0, y: 0 },
  };
  const target = {
    id: 'server-asteroid-10',
    position: { x: 140, y: -60 },
    velocity: { x: 0, y: 0 },
  };
  publishHarpoonField([distractor, target]);
  vi.spyOn(canvasManager, 'worldToScreen').mockImplementation((point, cameraPosition) => ({
    x: point.x - cameraPosition.x,
    y: point.y - cameraPosition.y,
  }));
  const camera = { x: 10, y: 20 };
  const hauler = new Ship({ kitId: 'hauler' });
  hauler.harpoonTargetId = 'server-asteroid-10';
  hauler.harpoonLatchPos = { x: 900, y: 900 };
  const first = paintRecorder();
  drawHaulerHarpoonVfx(first.ctx, hauler, 7, 9, camera);
  expect(first.lines).toEqual([[7, 9, 130, -80]]);
  expect(first.arcCenters).toEqual([[130, -80]]);
  expect(hauler.harpoonLatchPos).toEqual({ x: 140, y: -60 });
  expect(first.strokes).toContain('#E8D5A3');
  expect(first.strokes).toContain('#FDE68A');
  expect(first.fills).toContain('#FDE68A');
  expect(first.strokeWidths).toEqual([1.5, 1.5]);
  expect(first.arcRadii).toEqual([3.5]);

  publishHarpoonField([distractor, { ...target, position: { x: -60, y: 120 } }]);
  const refreshed = paintRecorder();
  drawHaulerHarpoonVfx(refreshed.ctx, hauler, 7, 9, camera);
  expect(refreshed.lines).toEqual([[7, 9, -70, 100]]);
  expect(refreshed.arcCenters).toEqual([[-70, 100]]);
  expect(hauler.harpoonLatchPos).toEqual({ x: -60, y: 120 });
});

test('tether VFX still paints from a stored latch pose when the field id is stale', () => {
  publishHarpoonField([]);
  const hauler = new Ship({ kitId: 'hauler' });
  hauler.harpoonTargetId = 'server-asteroid-0';
  hauler.harpoonLatchPos = { x: 40, y: 0 };
  const { ctx, strokes, fills, strokeWidths, arcRadii } = paintRecorder();
  drawHaulerHarpoonVfx(ctx, hauler, 0, 0, { x: 0, y: 0 });
  expect(strokes).toContain('#E8D5A3');
  expect(strokes).toContain('#FDE68A');
  expect(fills).toContain('#FDE68A');
  expect(strokeWidths.every((width) => width <= 2)).toBe(true);
  expect(arcRadii).toEqual([3.5]);
});

test('cream cable still paints while the Hauler hull is exploding', () => {
  publishHarpoonField([{ id: 'rock-1', position: { x: 40, y: 0 }, velocity: { x: 0, y: 0 } }]);
  const hauler = new Ship({ kitId: 'hauler' });
  hauler.harpoonTargetId = 'rock-1';
  hauler.exploding = true;
  hauler.health = 0;
  const { ctx, strokes, fills } = paintRecorder();
  drawHaulerHarpoonVfx(ctx, hauler, 0, 0, { x: 0, y: 0 });
  expect(strokes).toContain('#E8D5A3');
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
  const scout = new Ship({ kitId: 'scout' });
  scout.harpoonTargetId = 'rock-1';
  drawHaulerHarpoonVfx(ctx, scout, 0, 0, { x: 0, y: 0 });
  expect(calls).toEqual([]);
});

test.each(['scout', 'unlatched'] as const)('%s never paints a tow cable', (kind) => {
  publishHarpoonField([{ id: 'rock', position: { x: 40, y: 0 }, velocity: { x: 0, y: 0 } }]);
  const ship = new Ship({ kitId: kind === 'scout' ? 'scout' : 'hauler' });
  ship.harpoonTargetId = kind === 'scout' ? 'rock' : null;
  const { ctx, strokes, fills } = paintRecorder();
  drawHaulerHarpoonVfx(ctx, ship, 0, 0, { x: 0, y: 0 });
  expect(strokes).toEqual([]);
  expect(fills).toEqual([]);
});
