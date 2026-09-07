import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import {
  SAUCER_ART_PACK,
  SAUCER_CABIN_FILL_ALPHA,
  SAUCER_EO_SATELLITE_PACKS_HANDED,
  SAUCER_FIRING_SEGMENTS,
  SAUCER_HULL_COLOR,
  SAUCER_NPC_ART_ID,
  SAUCER_NPC_ART_IS_TEMPORARY,
  SAUCER_NPC_RENDER_LANGUAGE,
  SAUCER_RING_TICKS,
  SAUCER_SHOT_COLOR,
  SAUCER_USES_OUTLINE_ASTEROIDS_KIT_LANGUAGE,
  drawSaucerNpc,
  drawSaucerNpcFiring,
  drawSaucerNpcPlaceholder,
  getSaucerNpcArtId,
  isSaucerNpcArtTemporary,
  registerSaucerNpcPainter,
  setSaucerNpcArtId,
} from '../../../src/entities/npc/saucerRenderHook';

afterEach(() => {
  setSaucerNpcArtId('disc-temp');
});

test('saucer NPC is allowed SVG-like fidelity and is not a kit outline', () => {
  expect(SAUCER_NPC_RENDER_LANGUAGE).toBe('svg-fidelity');
  expect(SAUCER_USES_OUTLINE_ASTEROIDS_KIT_LANGUAGE).toBe(false);
  expect(SAUCER_HULL_COLOR).toBe('#C4B5FD');
  expect(SAUCER_SHOT_COLOR).toBe('#E9D5FF');
  expect(SAUCER_CABIN_FILL_ALPHA).toBeLessThanOrEqual(0.2);
  expect(SAUCER_CABIN_FILL_ALPHA).toBe(0.18);
  expect(SAUCER_RING_TICKS).toBe(8);
  expect(SAUCER_FIRING_SEGMENTS).toBe(2);
  expect(SAUCER_NPC_ART_IS_TEMPORARY).toBe(true);
  expect(SAUCER_NPC_ART_ID).toBe('disc-temp');
  expect(getSaucerNpcArtId()).toBe('disc-temp');
  expect(isSaucerNpcArtTemporary()).toBe(true);
  expect(SAUCER_EO_SATELLITE_PACKS_HANDED).toBe(false);
});

test('EO-sat swap hook stays empty until Game Director hands packs', () => {
  const calls: string[] = [];
  registerSaucerNpcPainter({
    id: 'eo-sat',
    temporary: false,
    draw: () => {
      calls.push('eo-sat');
    },
  });
  setSaucerNpcArtId('eo-sat');
  expect(SAUCER_EO_SATELLITE_PACKS_HANDED).toBe(false);
  expect(getSaucerNpcArtId()).toBe('eo-sat');
  drawSaucerNpc({} as CanvasRenderingContext2D, { x: 0, y: 0, radius: 12 });
  expect(calls).toEqual(['eo-sat']);
});

test('AD art-pack SVGs match the confirmed box spec', () => {
  const idle = readFileSync(resolve(SAUCER_ART_PACK.idleSvg), 'utf8');
  const firing = readFileSync(resolve(SAUCER_ART_PACK.firingSvg), 'utf8');

  for (const svg of [idle, firing]) {
    expect(svg).toContain(`stroke="${SAUCER_HULL_COLOR}"`);
    expect(svg).toContain(`fill-opacity="${SAUCER_CABIN_FILL_ALPHA}"`);
    expect((svg.match(/<ellipse\b/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(svg).toContain('<circle');
    expect((svg.match(/<line\b/g) ?? []).length).toBeGreaterThanOrEqual(SAUCER_RING_TICKS);
  }

  expect(idle.includes(SAUCER_SHOT_COLOR)).toBe(false);
  expect(firing).toContain(`stroke="${SAUCER_SHOT_COLOR}"`);
  const shotGroup = firing.match(/stroke="#E9D5FF"[\s\S]*?<\/g>/)?.[0] ?? '';
  expect((shotGroup.match(/<line\b/g) ?? []).length).toBe(SAUCER_FIRING_SEGMENTS);
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

test('firing saucer adds short shot segments off both rims', () => {
  const idle = mockCtx();
  const firing = mockCtx();
  drawSaucerNpc(idle.ctx, { x: 0, y: 0, radius: 12 });
  drawSaucerNpcFiring(firing.ctx, { x: 0, y: 0, radius: 12 });
  expect(firing.calls.filter((call) => call === 'lineTo').length).toBe(
    idle.calls.filter((call) => call === 'lineTo').length + SAUCER_FIRING_SEGMENTS
  );
});
