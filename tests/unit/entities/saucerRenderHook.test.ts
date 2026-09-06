import { expect, test } from 'vitest';
import {
  SAUCER_CABIN_FILL_ALPHA,
  SAUCER_HULL_COLOR,
  SAUCER_NPC_RENDER_LANGUAGE,
  SAUCER_RING_TICKS,
  SAUCER_SHOT_COLOR,
  SAUCER_USES_OUTLINE_ASTEROIDS_KIT_LANGUAGE,
  drawSaucerNpc,
  drawSaucerNpcFiring,
  drawSaucerNpcPlaceholder,
} from '../../../src/entities/npc/saucerRenderHook';

test('saucer NPC is allowed SVG-like fidelity and is not a kit outline', () => {
  expect(SAUCER_NPC_RENDER_LANGUAGE).toBe('svg-fidelity');
  expect(SAUCER_USES_OUTLINE_ASTEROIDS_KIT_LANGUAGE).toBe(false);
  expect(SAUCER_HULL_COLOR).toBe('#C4B5FD');
  expect(SAUCER_SHOT_COLOR).toBe('#E9D5FF');
  expect(SAUCER_CABIN_FILL_ALPHA).toBeLessThanOrEqual(0.2);
  expect(SAUCER_CABIN_FILL_ALPHA).toBe(0.18);
  expect(SAUCER_RING_TICKS).toBe(8);
});

function mockCtx(): { calls: string[]; ctx: CanvasRenderingContext2D } {
  const calls: string[] = [];
  const ctx = {
    save: () => calls.push('save'),
    restore: () => calls.push('restore'),
    beginPath: () => calls.push('beginPath'),
    ellipse: () => calls.push('ellipse'),
    arc: () => calls.push('arc'),
    fill: () => calls.push('fill'),
    stroke: () => calls.push('stroke'),
    moveTo: () => calls.push('moveTo'),
    lineTo: () => calls.push('lineTo'),
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineJoin: 'round',
    lineCap: 'round',
  } as unknown as CanvasRenderingContext2D;
  return { calls, ctx };
}

test('idle saucer strokes stacked ellipses, eight ticks, cabin fill, and a dish circle', () => {
  const { calls, ctx } = mockCtx();
  drawSaucerNpcPlaceholder(ctx, { x: 0, y: 0, radius: 12 });
  expect(calls.filter((call) => call === 'ellipse').length).toBeGreaterThanOrEqual(3);
  expect(calls.filter((call) => call === 'lineTo').length).toBeGreaterThanOrEqual(SAUCER_RING_TICKS);
  expect(calls).toContain('fill');
  expect(calls).toContain('stroke');
  expect(calls).toContain('arc');
});

test('firing saucer adds a short shot segment', () => {
  const idle = mockCtx();
  const firing = mockCtx();
  drawSaucerNpc(idle.ctx, { x: 0, y: 0, radius: 12 });
  drawSaucerNpcFiring(firing.ctx, { x: 0, y: 0, radius: 12 });
  expect(firing.calls.filter((call) => call === 'lineTo').length).toBeGreaterThan(
    idle.calls.filter((call) => call === 'lineTo').length
  );
});
