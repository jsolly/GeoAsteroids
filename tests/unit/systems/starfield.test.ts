import { expect, test } from 'vitest';

import { PALETTE, VISUAL } from '../../../src/constants';
import { getGameBoundary } from '../../../src/physics/boundary';
import {
  generateStarfield,
  generateViewportStars,
  titleStarCountForViewport,
} from '../../../src/rendering/starfield';
import { hexToRgba } from '../../../src/utils/colorUtils';

test('sky is identical every time it is generated so stars never twinkle or drift', () => {
  const a = generateStarfield(200, 1000, VISUAL.STAR_SEED);
  const b = generateStarfield(200, 1000, VISUAL.STAR_SEED);
  expect(a).toEqual(b);
  expect(a).toHaveLength(200);
});

test('every star sits inside the world boundary', () => {
  const { radius, cx, cy } = getGameBoundary();
  const stars = generateStarfield(VISUAL.STAR_COUNT, radius, VISUAL.STAR_SEED, cx, cy);
  for (const star of stars) {
    expect(Math.hypot(star.x - cx, star.y - cy)).toBeLessThanOrEqual(radius);
    expect(star.alpha).toBeGreaterThanOrEqual(VISUAL.STAR_ALPHA_MIN);
    expect(star.alpha).toBeLessThanOrEqual(VISUAL.STAR_ALPHA_MAX);
    expect(star.fillStyle).toBe(hexToRgba(PALETTE.STARS, star.alpha));
  }
});

test('star field stays sparse on a 1080p viewport', () => {
  const { radius } = getGameBoundary();
  const worldArea = Math.PI * radius * radius;
  const starsPerViewport = (VISUAL.STAR_COUNT / worldArea) * (1920 * 1080);
  expect(starsPerViewport).toBeLessThan(80);
  expect(starsPerViewport).toBeGreaterThan(15);
  expect(VISUAL.STAR_SIZE).toBeLessThanOrEqual(1);
});

test('title void stars are deterministic, in-viewport, and similarly sparse', () => {
  const count = titleStarCountForViewport(1920, 1080);
  const a = generateViewportStars(1920, 1080, count, VISUAL.STAR_SEED);
  const b = generateViewportStars(1920, 1080, count, VISUAL.STAR_SEED);
  expect(a).toEqual(b);
  expect(count).toBe(VISUAL.TITLE_STARS_PER_1080P);
  expect(count).toBeLessThan(80);
  expect(count).toBeGreaterThan(15);
  for (const star of a) {
    expect(star.x).toBeGreaterThanOrEqual(0);
    expect(star.x).toBeLessThanOrEqual(1920);
    expect(star.y).toBeGreaterThanOrEqual(0);
    expect(star.y).toBeLessThanOrEqual(1080);
    expect(star.alpha).toBeGreaterThanOrEqual(VISUAL.STAR_ALPHA_MIN);
    expect(star.alpha).toBeLessThanOrEqual(VISUAL.STAR_ALPHA_MAX);
    expect(star.fillStyle).toBe(hexToRgba(PALETTE.STARS, star.alpha));
  }
});
