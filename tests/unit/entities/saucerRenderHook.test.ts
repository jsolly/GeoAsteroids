import { expect, test } from 'vitest';
import {
  SAUCER_NPC_RENDER_LANGUAGE,
  SAUCER_USES_OUTLINE_ASTEROIDS_KIT_LANGUAGE,
  drawSaucerNpcPlaceholder,
} from '../../../src/entities/npc/saucerRenderHook';

test('saucer NPC is allowed SVG-like fidelity and is not a kit outline', () => {
  expect(SAUCER_NPC_RENDER_LANGUAGE).toBe('svg-fidelity');
  expect(SAUCER_USES_OUTLINE_ASTEROIDS_KIT_LANGUAGE).toBe(false);
});

test('saucer placeholder draws a filled disc, not a kit triangle', () => {
  const calls: string[] = [];
  const ctx = {
    save: () => calls.push('save'),
    restore: () => calls.push('restore'),
    beginPath: () => calls.push('beginPath'),
    ellipse: () => calls.push('ellipse'),
    fill: () => calls.push('fill'),
    globalAlpha: 1,
    fillStyle: '',
  } as unknown as CanvasRenderingContext2D;

  drawSaucerNpcPlaceholder(ctx, { x: 0, y: 0, radius: 12 }, '#fff');
  expect(calls).toContain('ellipse');
  expect(calls).toContain('fill');
  expect(calls).not.toContain('stroke');
});
