import { expect, test } from 'vitest';
import { PALETTE } from '../../../src/constants';
import {
  drawSoftFactionMark,
  FACTION_MARK_COLORS,
  FACTION_MARK_HULL_OFFSET_MAX_PX,
  FACTION_MARK_MAX_SCREEN_PX,
  FACTION_MARK_MIN_SCREEN_PX,
  FACTION_MARK_PAINTERS,
  FACTION_MARK_RADIUS_RATIO,
  factionMarkAnchor,
  factionMarkScreenSize,
  getFactionMarkColor,
  OWNERSHIP_HULL_COLORS,
  registerFactionMarkPainter,
} from '../../../src/entities/player/factionMarkPainters';
import { Player } from '../../../src/entities/player/Player';
import { MockPlayerInput } from '../../../src/input/MockPlayerInput';
import { getFactionColor } from '../../../src/utils/colorUtils';

test('ION and EMBER marks use the Game Director swatches, not ownership hull paint', () => {
  expect(FACTION_MARK_COLORS.ion).toBe('#A8A0C8');
  expect(FACTION_MARK_COLORS.ember).toBe('#D4B896');
  expect(OWNERSHIP_HULL_COLORS.local).toBe('#5EEAD4');
  expect(OWNERSHIP_HULL_COLORS.bot).toBe('#FB923C');
  expect(getFactionMarkColor('ion')).not.toBe(PALETTE.LOCAL);
  expect(getFactionMarkColor('ion')).not.toBe(PALETTE.BOT);
  expect(getFactionMarkColor('ember')).not.toBe(PALETTE.LOCAL);
  expect(getFactionMarkColor('ember')).not.toBe(PALETTE.BOT);
  expect(FACTION_MARK_RADIUS_RATIO).toBeLessThanOrEqual(0.35);
  expect(FACTION_MARK_MIN_SCREEN_PX).toBeGreaterThanOrEqual(5);
  expect(FACTION_MARK_MAX_SCREEN_PX).toBeLessThanOrEqual(9);
  expect(FACTION_MARK_MIN_SCREEN_PX).toBeLessThan(FACTION_MARK_MAX_SCREEN_PX);
});

test('playfield zoom cannot shrink ION/EMBER marks below a readable chip', () => {
  expect(factionMarkScreenSize(2.1)).toBe(FACTION_MARK_MIN_SCREEN_PX);
  expect(factionMarkScreenSize(4)).toBe(FACTION_MARK_MIN_SCREEN_PX);
  expect(factionMarkScreenSize(32)).toBeLessThanOrEqual(FACTION_MARK_MAX_SCREEN_PX);
  expect(factionMarkScreenSize(32)).toBeGreaterThanOrEqual(FACTION_MARK_MIN_SCREEN_PX);
  expect(factionMarkScreenSize(Number.NaN)).toBe(FACTION_MARK_MIN_SCREEN_PX);
});

test('hull marks park ahead of the silhouette; HUD marks stay on their pixel', () => {
  const hull = factionMarkAnchor({
    x: 100,
    y: 80,
    radius: 3,
    angle: 0,
    park: 'hull',
  });
  expect(hull.x).toBeGreaterThan(100);
  expect(hull.y).toBe(80);
  expect(hull.x - 100).toBeLessThanOrEqual(FACTION_MARK_HULL_OFFSET_MAX_PX);
  expect(hull.size).toBe(FACTION_MARK_MIN_SCREEN_PX);

  const point = factionMarkAnchor({
    x: 20,
    y: 12,
    radius: 8,
    angle: Math.PI / 2,
    park: 'point',
  });
  expect(point).toEqual({ x: 20, y: 12, size: factionMarkScreenSize(8) });
});

test('hull stroke stays local / remote / bot even when a side is assigned', () => {
  const ionLocal = new Player({
    id: 'ion-local',
    name: 'Ion',
    type: 'local',
    input: new MockPlayerInput(),
    factionId: 'ion',
  });
  const emberBot = new Player({
    id: 'ember-bot',
    name: 'Ember',
    type: 'bot',
    input: new MockPlayerInput(),
    factionId: 'ember',
  });
  expect(ionLocal.color).toBe(getFactionColor('local'));
  expect(ionLocal.ship.color).toBe(PALETTE.LOCAL);
  expect(emberBot.color).toBe(getFactionColor('bot'));
  expect(emberBot.color).not.toBe(FACTION_MARK_COLORS.ember);
});

function mockCtx(): { calls: string[]; colors: string[]; ctx: CanvasRenderingContext2D } {
  const calls: string[] = [];
  const colors: string[] = [];
  const ctx = {
    save: () => calls.push('save'),
    restore: () => calls.push('restore'),
    beginPath: () => calls.push('beginPath'),
    moveTo: () => calls.push('moveTo'),
    lineTo: () => calls.push('lineTo'),
    closePath: () => calls.push('closePath'),
    stroke: () => calls.push('stroke'),
    fill: () => calls.push('fill'),
    set strokeStyle(value: string) {
      colors.push(value);
    },
    get strokeStyle() {
      return colors.at(-1) ?? '';
    },
    lineWidth: 1,
    lineCap: 'round',
    lineJoin: 'round',
  } as unknown as CanvasRenderingContext2D;
  return { calls, colors, ctx };
}

test('unset side draws no mark', () => {
  const { calls, ctx } = mockCtx();
  drawSoftFactionMark(ctx, undefined, { x: 0, y: 0, radius: 16, angle: 0 });
  expect(calls).toEqual([]);
});

test('ION paints a tiny chevron and EMBER paints a tiny diamond', () => {
  const ion = mockCtx();
  drawSoftFactionMark(ion.ctx, 'ion', { x: 0, y: 0, radius: 16, angle: 0 });
  expect(ion.colors).toContain('#A8A0C8');
  expect(ion.calls).toContain('lineTo');
  expect(ion.calls).not.toContain('fill');
  expect(ion.calls).not.toContain('ellipse');

  const ember = mockCtx();
  drawSoftFactionMark(ember.ctx, 'ember', { x: 0, y: 0, radius: 16, angle: 0 });
  expect(ember.colors).toContain('#D4B896');
  expect(ember.calls).toContain('closePath');
  expect(ember.calls).not.toContain('fill');
});

test('FACTION_MARK_PAINTERS hook can swap a side without touching hull colors', () => {
  const original = FACTION_MARK_PAINTERS.ion;
  const calls: string[] = [];
  registerFactionMarkPainter('ion', () => {
    calls.push('swap');
  });
  const { ctx } = mockCtx();
  drawSoftFactionMark(ctx, 'ion', { x: 0, y: 0, radius: 16, angle: 0 });
  expect(calls).toEqual(['swap']);
  registerFactionMarkPainter('ion', original);
});
