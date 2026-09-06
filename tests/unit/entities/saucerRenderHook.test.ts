import { expect, test } from 'vitest';
import {
  SAUCER_CABIN_FILL_ALPHA,
  SAUCER_HULL_COLOR,
  SAUCER_NPC_RENDER_LANGUAGE,
  SAUCER_SHOT_COLOR,
  SAUCER_USES_OUTLINE_ASTEROIDS_KIT_LANGUAGE,
  drawSaucerNpcPlaceholder,
} from '../../../src/entities/npc/saucerRenderHook';

test('saucer NPC is allowed SVG-like fidelity and is not a kit outline', () => {
  expect(SAUCER_NPC_RENDER_LANGUAGE).toBe('svg-fidelity');
  expect(SAUCER_USES_OUTLINE_ASTEROIDS_KIT_LANGUAGE).toBe(false);
  expect(SAUCER_HULL_COLOR).toBe('#C4B5FD');
  expect(SAUCER_SHOT_COLOR).toBe('#E9D5FF');
  expect(SAUCER_CABIN_FILL_ALPHA).toBeLessThanOrEqual(0.2);
});

test('saucer draws stacked ellipses, ring ticks, and an antenna dish', () => {
  const calls: string[] = [];
  const ctx = {
    save: () => calls.push('save'),
    restore: () => calls.push('restore'),
    beginPath: () => calls.push('beginPath'),
    ellipse: () => calls.push('ellipse'),
    fill: () => calls.push('fill'),
    stroke: () => calls.push('stroke'),
    moveTo: () => calls.push('moveTo'),
    lineTo: () => calls.push('lineTo'),
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
  } as unknown as CanvasRenderingContext2D;

  drawSaucerNpcPlaceholder(ctx, { x: 0, y: 0, radius: 12 });
  expect(calls.filter((call) => call === 'ellipse').length).toBeGreaterThanOrEqual(3);
  expect(calls).toContain('fill');
  expect(calls).toContain('stroke');
  expect(calls).toContain('lineTo');
});
