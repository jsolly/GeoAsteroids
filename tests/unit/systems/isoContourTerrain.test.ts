import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

import { PALETTE, VISUAL } from '../../../src/constants';
import { contourSegmentCount, extractIsoContours } from '../../../src/physics/terrain/contours';
import { createHeightfield, sampleGradient, sampleHeight } from '../../../src/physics/terrain/heightfield';
import { applySlopeForce } from '../../../src/physics/terrain/slopeForce';
import { TERRAIN } from '../../../src/physics/terrain/terrainConfig';
import { applyTerrainSeed, ensureTerrain, getTerrainSeed } from '../../../src/physics/terrain/terrainSession';
import { GameEngine } from '../../../server/core/GameEngine';

const BOUNDS = { cx: 0, cy: 0, radius: 3100 };

function steepestSample(seed: number): { x: number; y: number; steep: number } {
  const field = createHeightfield(seed, BOUNDS);
  let best = { x: 800, y: 0, steep: 0 };
  for (let a = 0; a < 24; a++) {
    const angle = (a / 24) * Math.PI * 2;
    for (const r of [700, 1100, 1500, 1900]) {
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      const g = sampleGradient(field, x, y);
      const steep = Math.hypot(g.x, g.y);
      if (steep > best.steep) {
        best = { x, y, steep };
      }
    }
  }
  return best;
}

describe('seeded heightfield is shared', () => {
  test('the same seed produces the same heights and contour set', () => {
    const a = createHeightfield(TERRAIN.DEFAULT_SEED, BOUNDS);
    const b = createHeightfield(TERRAIN.DEFAULT_SEED, BOUNDS);
    const samples = [
      { x: 0, y: 0 },
      { x: 400, y: -200 },
      { x: -1200, y: 800 },
      { x: 2000, y: 1400 },
    ];
    for (const p of samples) {
      expect(sampleHeight(a, p.x, p.y)).toBe(sampleHeight(b, p.x, p.y));
    }
    expect(extractIsoContours(a)).toEqual(extractIsoContours(b));
  });

  test('a different seed changes the field', () => {
    const a = createHeightfield(TERRAIN.DEFAULT_SEED, BOUNDS);
    const b = createHeightfield(TERRAIN.DEFAULT_SEED + 99, BOUNDS);
    expect(sampleHeight(a, 1100, -400)).not.toBe(sampleHeight(b, 1100, -400));
  });

  test('gameState carries the room seed so late joiners match', () => {
    const engine = new GameEngine(1);
    const state = engine.getGameState();
    expect(state.terrainSeed).toBe(TERRAIN.DEFAULT_SEED);
    expect(engine.getTerrainSeed()).toBe(getTerrainSeed());
    applyTerrainSeed(state.terrainSeed);
    expect(getTerrainSeed()).toBe(TERRAIN.DEFAULT_SEED);
    engine.stopGameLoop();
  });
});

describe('iso contours encode elevation', () => {
  test('tight contour spacing lines up with a steep gradient', () => {
    const field = createHeightfield(TERRAIN.DEFAULT_SEED, BOUNDS);
    const levels = extractIsoContours(field);
    expect(contourSegmentCount(levels)).toBeGreaterThan(200);

    const cell = 280;
    const buckets: Array<{ steep: number; segments: number; count: number }> = [];
    for (let x = -1800; x <= 1800; x += cell) {
      for (let y = -1800; y <= 1800; y += cell) {
        if (x * x + y * y > BOUNDS.radius * BOUNDS.radius) {
          continue;
        }
        const steep = Math.hypot(sampleGradient(field, x, y).x, sampleGradient(field, x, y).y);
        let segments = 0;
        for (const level of levels) {
          for (const seg of level.segments) {
            const mx = (seg.ax + seg.bx) * 0.5;
            const my = (seg.ay + seg.by) * 0.5;
            if (Math.abs(mx - x) <= cell / 2 && Math.abs(my - y) <= cell / 2) {
              segments++;
            }
          }
        }
        buckets.push({ steep, segments, count: 1 });
      }
    }

    expect(buckets.length).toBeGreaterThan(20);
    const ranked = [...buckets].sort((a, b) => a.steep - b.steep);
    const quartile = Math.max(1, Math.floor(ranked.length / 4));
    const flatish = ranked.slice(0, quartile);
    const steepish = ranked.slice(-quartile);
    const avgSteep = steepish.reduce((sum, b) => sum + b.segments, 0) / steepish.length;
    const avgFlat = flatish.reduce((sum, b) => sum + b.segments, 0) / flatish.length;
    expect(avgSteep).toBeGreaterThan(avgFlat);
  });

  test('contours stay inside the circular arena', () => {
    const field = createHeightfield(TERRAIN.DEFAULT_SEED, BOUNDS);
    for (const level of extractIsoContours(field)) {
      for (const seg of level.segments) {
        const mx = (seg.ax + seg.bx) * 0.5;
        const my = (seg.ay + seg.by) * 0.5;
        expect(Math.hypot(mx, my)).toBeLessThanOrEqual(BOUNDS.radius + 1);
      }
    }
  });
});

describe('ships feel the slope', () => {
  test('a coasting ship accelerates downhill and slows uphill', () => {
    const field = createHeightfield(TERRAIN.DEFAULT_SEED, BOUNDS);
    const peak = steepestSample(TERRAIN.DEFAULT_SEED);
    expect(peak.steep).toBeGreaterThan(0.001);

    const g = sampleGradient(field, peak.x, peak.y);
    const len = Math.hypot(g.x, g.y);
    const nx = g.x / len;
    const ny = g.y / len;

    const downhill = { x: 0, y: 0 };
    applySlopeForce(downhill, { x: peak.x, y: peak.y }, field, 1);
    const downDot = downhill.x * -nx + downhill.y * -ny;
    expect(downDot).toBeGreaterThan(0);

    const uphill = { x: nx * 2, y: ny * 2 };
    const before = Math.hypot(uphill.x, uphill.y);
    applySlopeForce(uphill, { x: peak.x, y: peak.y }, field, 1);
    expect(Math.hypot(uphill.x, uphill.y)).toBeLessThan(before);
  });

  test('origin spawn is flat so parked ships do not slide', () => {
    const field = createHeightfield(TERRAIN.DEFAULT_SEED, BOUNDS);
    const g = sampleGradient(field, 0, 0);
    expect(Math.hypot(g.x, g.y)).toBeLessThan(1e-5);
    const velocity = { x: 1, y: 1 };
    applySlopeForce(velocity, { x: 0, y: 0 }, field);
    expect(velocity.x).toBeCloseTo(1, 6);
    expect(velocity.y).toBeCloseTo(1, 6);
  });

  test('player and bot movement both apply the shared slope helper', () => {
    const shipSrc = readFileSync(resolve(process.cwd(), 'src/entities/ship/Ship.ts'), 'utf8');
    const moveSrc = readFileSync(
      resolve(process.cwd(), 'src/entities/ship/ShipMovementManager.ts'),
      'utf8'
    );
    const botSrc = readFileSync(resolve(process.cwd(), 'server/core/EntityManager.ts'), 'utf8');
    expect(shipSrc).toMatch(/applySharedShipSlope\(this\.velocity, this\.position\)/);
    expect(moveSrc).toMatch(/applySharedShipSlope\(state\.velocity, state\.position\)/);
    expect(botSrc).toMatch(/applySharedShipSlope\(bot\.velocity, bot\.position\)/);
  });
});

describe('muted contour chrome', () => {
  test('contour strokes stay darker and thinner than ships and lasers', () => {
    expect(PALETTE.CONTOUR.toLowerCase()).not.toBe('#ffffff');
    expect(PALETTE.CONTOUR.toLowerCase()).not.toBe(PALETTE.LOCAL.toLowerCase());
    expect(PALETTE.CONTOUR.toLowerCase()).not.toBe(PALETTE.LASER_LOCAL.toLowerCase());
    expect(VISUAL.CONTOUR_STROKE_WIDTH).toBeLessThanOrEqual(VISUAL.SHIP_STROKE_WIDTH);
    expect(VISUAL.CONTOUR_ALPHA).toBeLessThanOrEqual(0.2);
    expect(VISUAL.CONTOUR_INDEX_ALPHA).toBeLessThanOrEqual(0.28);
    expect(VISUAL.CONTOUR_INDEX_ALPHA).toBeGreaterThan(VISUAL.CONTOUR_ALPHA);
  });

  test('playfield paints contours after the starfield and before ships', () => {
    const canvasSrc = readFileSync(resolve(process.cwd(), 'src/rendering/canvas.ts'), 'utf8');
    const star = canvasSrc.indexOf('drawStarfield(');
    const contour = canvasSrc.indexOf('drawIsoContours(');
    const ships = canvasSrc.indexOf('drawShipAtPosition(');
    expect(star).toBeGreaterThan(-1);
    expect(contour).toBeGreaterThan(star);
    expect(ships).toBeGreaterThan(contour);
  });
});

test('ensureTerrain caches the active room field', () => {
  const first = ensureTerrain(TERRAIN.DEFAULT_SEED, BOUNDS);
  const second = ensureTerrain(TERRAIN.DEFAULT_SEED, BOUNDS);
  expect(second).toBe(first);
});
