import { describe, expect, test } from 'vitest';
import { AsteroidManager } from '../../../server/core/AsteroidManager';
import { RNGService } from '../../../server/core/RNGService';
import { partitionAsteroidSnapshot } from '../../../src/network/services/asteroidFieldSync';
import { getAsteroidFieldRadius, stepAsteroidMotion } from '../../../src/physics/asteroidMotion';
import {
  PLAYFIELD_COMFORT_INSET,
  countRocksOnCanvas,
  drawingOffsets,
  playfieldZoom,
  radarBeltVisibleOnPlayfield,
} from '../../../src/rendering/playfieldCamera';

const SMALL = { width: 800, height: 600 };
const HD = { width: 1920, height: 1080 };

/** Live www poses captured after #444 (c29e9f9): humans outside / on the rim of the 1200 belt. */
const TAB_A_IN_BELT = { x: 0, y: 0 };
const TAB_B_OUTSIDE = { x: -1392, y: -487 };
const RIM_1080P_MISS = { x: 326, y: -1098 };

function beltAfterTicks(seed: number, count: number, ticks: number) {
  const manager = new AsteroidManager(new RNGService(seed));
  manager.createAsteroids(count);
  for (let i = 0; i < ticks; i++) {
    manager.updateMotion();
  }
  return manager.getAllAsteroids().map((asteroid) => ({
    id: asteroid.id,
    position: asteroid.position,
    r: asteroid.size,
    offsets: asteroid.offsets,
  }));
}

describe('root cause: camera frustum vs the radar belt (not wrap / stale / offsets)', () => {
  test('same belt: Tab A at origin sees rocks, Tab B at the live far pose sees none at 1:1', () => {
    const field = beltAfterTicks(11, 20, 70 * 60);
    expect(field.length).toBeGreaterThan(0);
    for (const rock of field) {
      expect(Math.hypot(rock.position.x, rock.position.y)).toBeLessThanOrEqual(
        getAsteroidFieldRadius() + 1
      );
    }

    const tabA = countRocksOnCanvas(field, TAB_A_IN_BELT, SMALL, 1);
    const tabB = countRocksOnCanvas(field, TAB_B_OUTSIDE, SMALL, 1);
    const rim = countRocksOnCanvas(field, RIM_1080P_MISS, SMALL, 1);

    expect(tabA, 'origin camera still sees the #444 belt on 800×600').toBeGreaterThan(0);
    expect(tabB, 'live far-ship pose is the empty-canvas + minimap-dots FAIL').toBe(0);
    expect(rim, '800×600 at the old 1145-radius pose is also empty').toBe(0);
    expect(countRocksOnCanvas(field, TAB_B_OUTSIDE, HD, 1)).toBeGreaterThanOrEqual(0);
  });

  test('minimap-style positions are present while the 1:1 playfield is empty', () => {
    const field = beltAfterTicks(11, 20, 70 * 60);
    expect(field.length).toBeGreaterThan(0);
    expect(countRocksOnCanvas(field, TAB_B_OUTSIDE, SMALL, 1)).toBe(0);
  });

  test('a rock 900px out drifts onto an 800×600 origin camera in ~15s (QA reappear)', () => {
    let position = { x: 900, y: 0 };
    const velocity = { x: -50 / 60, y: 0 };
    const ship = { x: 0, y: 0 };
    expect(countRocksOnCanvas([{ position }], ship, SMALL, 1)).toBe(0);
    for (let i = 0; i < 15 * 60; i++) {
      position = stepAsteroidMotion(position, velocity).position;
    }
    expect(countRocksOnCanvas([{ position }], ship, SMALL, 1)).toBe(1);
  });

  test('two clients applying the same snapshot share ids — not a stale empty belt', () => {
    const field = beltAfterTicks(3, 12, 0);
    const payload = field.map((rock) => ({
      id: rock.id,
      position: rock.position,
      velocity: { x: 0, y: 0 },
      size: rock.r,
      jaggedness: 0.5,
      rotation: 0,
      angularVelocity: 0,
      health: 100,
      maxHealth: 100,
      vertices: 8,
      offsets: rock.offsets,
    }));
    const a = partitionAsteroidSnapshot(payload, new Set());
    const b = partitionAsteroidSnapshot(payload, new Set());
    expect(a.created.map((rock) => rock.id)).toEqual(b.created.map((rock) => rock.id));
    expect(a.removed).toEqual([]);
    expect(b.removed).toEqual([]);
  });

  test('empty offsets still have a stroke path (draw-path hole closed)', () => {
    expect(drawingOffsets([])).toEqual([1]);
    expect(drawingOffsets([1.1, 0.9])).toEqual([1.1, 0.9]);
  });
});

describe('playfield zoom paints the radar belt when 1:1 would be empty', () => {
  test('zoom stays 1 when the ship is already looking at rocks', () => {
    const field = beltAfterTicks(11, 20, 70 * 60);
    expect(playfieldZoom(field, TAB_A_IN_BELT, SMALL)).toBe(1);
    expect(playfieldZoom(field, TAB_A_IN_BELT, HD)).toBe(1);
  });

  test('two far cameras both get rocks after zoom — the two-tab FAIL', () => {
    const field = beltAfterTicks(11, 20, 70 * 60);
    const scaleA = playfieldZoom(field, TAB_A_IN_BELT, SMALL);
    const scaleB = playfieldZoom(field, TAB_B_OUTSIDE, SMALL);
    const scaleRim = playfieldZoom(field, RIM_1080P_MISS, SMALL);
    expect(countRocksOnCanvas(field, TAB_A_IN_BELT, SMALL, scaleA)).toBeGreaterThan(0);
    expect(countRocksOnCanvas(field, TAB_B_OUTSIDE, SMALL, scaleB)).toBeGreaterThan(0);
    expect(countRocksOnCanvas(field, RIM_1080P_MISS, SMALL, scaleRim)).toBeGreaterThan(0);
    expect(scaleB).toBeLessThan(1);
    expect(scaleRim).toBeLessThan(1);
  });

  test('after 70s both a spawn pose and a far pose still see the belt', () => {
    const field = beltAfterTicks(21, 20, 70 * 60);
    const ships = [TAB_A_IN_BELT, TAB_B_OUTSIDE, { x: 2000, y: 1500 }, { x: 150, y: -40 }];
    for (const ship of ships) {
      const scale = playfieldZoom(field, ship, SMALL);
      expect(
        countRocksOnCanvas(field, ship, SMALL, scale),
        `800×600 ship at ${ship.x},${ship.y}`
      ).toBeGreaterThan(0);
      expect(countRocksOnCanvas(field, ship, HD, playfieldZoom(field, ship, HD))).toBeGreaterThan(0);
    }
  });

  test('containing ships at the field rim still misses 1:1 — why #445 was the wrong size', () => {
    const field = beltAfterTicks(11, 20, 70 * 60);
    const rim = { x: getAsteroidFieldRadius(), y: 0 };
    const oneToOne = countRocksOnCanvas(field, rim, SMALL, 1);
    const zoomed = countRocksOnCanvas(field, rim, SMALL, playfieldZoom(field, rim, SMALL));
    expect(zoomed).toBeGreaterThan(0);
    expect(zoomed).toBeGreaterThanOrEqual(oneToOne);
  });

  test('one edge-clip rock does not pin 1:1 while the belt is off-screen', () => {
    const ship = { x: 0, y: 0 };
    const edge = {
      position: { x: SMALL.width / 2 - 4, y: 0 },
      r: 20,
    };
    const belt = [
      edge,
      { position: { x: 900, y: 0 }, r: 20 },
      { position: { x: 950, y: 80 }, r: 20 },
      { position: { x: 880, y: -60 }, r: 20 },
    ];
    expect(countRocksOnCanvas([edge], ship, SMALL, 1)).toBe(1);
    expect(countRocksOnCanvas([edge], ship, SMALL, 1, -PLAYFIELD_COMFORT_INSET)).toBe(0);
    const scale = playfieldZoom(belt, ship, SMALL);
    expect(scale).toBeLessThan(1);
    expect(countRocksOnCanvas(belt, ship, SMALL, scale)).toBeGreaterThan(1);
  });

  test('PO bar: after 60s and 70s, minimap dots still mean on-canvas rocks', () => {
    const ships = [TAB_A_IN_BELT, TAB_B_OUTSIDE, RIM_1080P_MISS, { x: 2000, y: 1500 }];
    for (const seconds of [60, 70]) {
      const field = beltAfterTicks(11, 20, seconds * 60);
      expect(field.length, `T+${seconds}s belt (radar dots)`).toBeGreaterThan(0);
      for (const ship of ships) {
        const scale = playfieldZoom(field, ship, SMALL);
        expect(
          countRocksOnCanvas(field, ship, SMALL, scale),
          `T+${seconds}s 800×600 ship ${ship.x},${ship.y}`
        ).toBeGreaterThan(0);
      }
    }
  });

  test('two rim stragglers do not pin 1:1 while the pack is only on radar', () => {
    const ship = { x: 0, y: 0 };
    const stragglers = [
      { position: { x: 80, y: 40 }, r: 20 },
      { position: { x: -60, y: 50 }, r: 20 },
    ];
    const pack = [
      { position: { x: 900, y: 180 }, r: 20 },
      { position: { x: 860, y: 240 }, r: 20 },
      { position: { x: 940, y: 120 }, r: 20 },
      { position: { x: 880, y: 300 }, r: 20 },
    ];
    const field = [...stragglers, ...pack];
    expect(countRocksOnCanvas(stragglers, ship, SMALL, 1, -PLAYFIELD_COMFORT_INSET)).toBe(2);
    expect(countRocksOnCanvas(pack, ship, SMALL, 1)).toBe(0);
    expect(playfieldZoom(field, ship, SMALL)).toBeLessThan(1);
    expect(radarBeltVisibleOnPlayfield(field, ship, SMALL)).toBe(true);
    expect(countRocksOnCanvas(field, ship, SMALL, playfieldZoom(field, ship, SMALL))).toBe(
      field.length
    );
  });

  test('Pilot B pass 4: a left-edge speck at ~60s does not leave the belt on radar only', () => {
    const ship = { x: 0, y: 0 };
    const leftEdge = { position: { x: -(SMALL.width / 2) + 8, y: 40 }, r: 40 };
    const pack = [
      { position: { x: 820, y: 180 }, r: 20 },
      { position: { x: 760, y: 240 }, r: 20 },
      { position: { x: 880, y: 120 }, r: 20 },
      { position: { x: 800, y: 300 }, r: 20 },
    ];
    const field = [leftEdge, ...pack];
    expect(countRocksOnCanvas([leftEdge], ship, SMALL, 1)).toBe(1);
    expect(countRocksOnCanvas(pack, ship, SMALL, 1)).toBe(0);
    expect(playfieldZoom(field, ship, SMALL)).toBeLessThan(1);
    expect(radarBeltVisibleOnPlayfield(field, ship, SMALL)).toBe(true);
    expect(countRocksOnCanvas(field, ship, SMALL, playfieldZoom(field, ship, SMALL))).toBe(field.length);
  });

  test('Pilot B pass 4: T+60 empty 1:1 and T+90 recover both stay painted', () => {
    const ships = [TAB_A_IN_BELT, TAB_B_OUTSIDE, RIM_1080P_MISS];
    for (const seconds of [60, 75, 90]) {
      const field = beltAfterTicks(11, 20, seconds * 60);
      expect(field.length).toBeGreaterThan(0);
      for (const ship of ships) {
        expect(
          radarBeltVisibleOnPlayfield(field, ship, SMALL),
          `T+${seconds}s radar dots must stay on canvas at ${ship.x},${ship.y}`
        ).toBe(true);
      }
    }
    const emptyThenRecover = beltAfterTicks(11, 20, 60 * 60);
    expect(countRocksOnCanvas(emptyThenRecover, TAB_B_OUTSIDE, SMALL, 1)).toBe(0);
    expect(radarBeltVisibleOnPlayfield(emptyThenRecover, TAB_B_OUTSIDE, SMALL)).toBe(true);
  });

  test('a pending nearby rock does not hide the radar belt', () => {
    const ship = { x: 0, y: 0 };
    const field = [
      { position: { x: 10, y: 0 }, r: 20, pendingDestruction: true },
      { position: { x: 900, y: 0 }, r: 20 },
      { position: { x: 940, y: 40 }, r: 20 },
    ];
    expect(countRocksOnCanvas(field, ship, SMALL, 1)).toBe(1);
    const scale = playfieldZoom(field, ship, SMALL);
    expect(scale).toBeLessThan(1);
    const drawable = field.filter((rock) => !rock.pendingDestruction);
    expect(countRocksOnCanvas(drawable, ship, SMALL, scale)).toBeGreaterThan(0);
  });
});
