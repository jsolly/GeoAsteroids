import { afterEach, expect, test, vi } from 'vitest';
import { FurnaceField } from '../../../shared/furnaceField';
import { SHIP_ABILITY } from '../../../shared/shipKits';
import { ensureTerrain, getTerrainField } from '../../../shared/terrainField';
import { isMusicThreatActive, resetMusicThreats } from '../../../src/audio/musicThreat';
import { createPlayer } from '../../../src/entities/player/createPlayer';
import { Roid, RoidBelt } from '../../../src/entities/roid/Roid';
import * as contours from '../../../src/physics/terrain/contours';
import { setSpiderField } from '../../../src/physics/terrain/spiderSession';
import {
  builtContourPatchCount,
  getTerrainContours,
  peekBuiltContourPatch,
  stopTerrainPrefetch,
} from '../../../src/physics/terrain/terrainSession';
import { drawGame, scanCameraZoom } from '../../../src/rendering/canvas';
import { canvasManager } from '../../../src/rendering/canvasSurface';
import * as rasterSurface from '../../../src/rendering/rasterSurface';
import type { SimpleScanScene } from '../../../src/rendering/simpleScanRenderer';
import * as spiderFeet from '../../../src/rendering/spiderFootContacts';
import { TestPath2D } from '../../support/TestPath2D';
import { setWindowViewport } from '../../support/viewport';

const originalLocation = window.location.href;
const originalTerrain = getTerrainField();
const restoreViewports: Array<() => void> = [];

afterEach(() => {
  canvasManager.destroy();
  setSpiderField(undefined);
  resetMusicThreats();
  stopTerrainPrefetch();
  ensureTerrain(originalTerrain.seed, originalTerrain);
  window.history.replaceState(null, '', originalLocation);
  for (const restore of restoreViewports.reverse()) {
    restore();
  }
  restoreViewports.length = 0;
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function mount(mode: 'simple' | 'full', width = 800, height = 1094, dpr = 1.5) {
  restoreViewports.push(setWindowViewport(width, height, dpr));
  window.history.replaceState(null, '', `/?performance=collect&scanDetail=${mode}`);
  canvasManager.initialize(document.querySelector<HTMLCanvasElement>('#gameCanvas'));
  return canvasManager.requireContext();
}

function scene(): SimpleScanScene {
  const localPlayer = createPlayer({
    id: 'scan-resource-pilot',
    name: 'Pilot',
    type: 'local',
    position: { x: 0, y: 0 },
    kitId: 'scout',
  });
  localPlayer.ship.blinkCount = 0;
  return {
    localPlayer,
    players: [localPlayer],
    roids: [],
    loot: [],
    lootBlast: null,
    pickups: [],
    spiders: { spiders: [], nests: [] },
    recovery: [],
    rolyPolys: [],
    bridges: [],
    remains: [],
    campaign: undefined,
    terrain: ensureTerrain(737, { cx: 0, cy: 0, radius: 3100 }),
    furnaces: new FurnaceField(),
    exploration: [],
  };
}

function scanAt(now: number) {
  canvasManager.easeZoomToward(0.25, now);
}

function returnToFlight(from: number) {
  for (let step = 1; step <= 12; step++) {
    canvasManager.easeZoomToward(1, from + step * 200);
  }
}

function observeComposites(ctx: CanvasRenderingContext2D) {
  return vi.spyOn(ctx, 'drawImage');
}

function drawnSurface(draw: ReturnType<typeof observeComposites>) {
  const source = draw.mock.calls.at(-1)?.[0];
  if (!(source instanceof HTMLCanvasElement)) {
    throw new Error('Expected the live Scan raster to be composited from a canvas');
  }
  return source;
}

test('one bounded Scan raster survives fractional zoom, then flight releases its backing storage', () => {
  const ctx = mount('simple');
  const draw = vi.spyOn(ctx, 'drawImage');
  const world = scene();
  scanAt(0);
  expect(canvasManager.usesSimpleScan()).toBe(true);
  canvasManager.drawSimpleScan(world, 0);
  const surface = drawnSurface(draw);
  expect({ width: surface.width, height: surface.height }).toEqual({ width: 600, height: 820 });
  expect(canvasManager.readSimpleScanDiagnostics()).toMatchObject({
    active: true,
    ownedPixels: 492000,
    mode: 'simple',
    reason: 'forced-simple',
  });

  for (const now of [16, 50, 125, 300, 700]) {
    scanAt(now);
    canvasManager.drawSimpleScan(world, now);
    expect(drawnSurface(draw)).toBe(surface);
  }
  expect(canvasManager.getViewportSize()).toEqual({ width: 800, height: 1094 });
  expect(ctx.getTransform()).toMatchObject({ a: 1.5, b: 0, c: 0, d: 1.5, e: 0, f: 0 });

  canvasManager.easeZoomToward(1, 716);
  expect(canvasManager.usesSimpleScan()).toBe(true);
  canvasManager.drawSimpleScan(world, 716);
  expect(drawnSurface(draw)).toBe(surface);
  returnToFlight(716);
  expect(canvasManager.usesSimpleScan()).toBe(false);
  expect(canvasManager.readSimpleScanDiagnostics().ownedPixels).toBe(0);
  expect({ width: surface.width, height: surface.height }).toEqual({ width: 0, height: 0 });

  scanAt(3200);
  canvasManager.drawSimpleScan(world, 3200);
  const nextSurface = drawnSurface(draw);
  expect(nextSurface).not.toBe(surface);
  canvasManager.destroy();
  expect({ width: nextSurface.width, height: nextSurface.height }).toEqual({ width: 0, height: 0 });
  expect(canvasManager.readSimpleScanDiagnostics()).toMatchObject({
    active: false,
    ownedPixels: 0,
  });
});

test.each(['simple', 'full'] as const)(
  '%s Scan restores its flight rendering at the intended return cadence',
  (mode) => {
    const ctx = mount(mode);
    const draw = observeComposites(ctx);
    const world = scene();
    world.localPlayer.ship.abilityActiveFrames = SHIP_ABILITY.SCAN_FRAMES;
    const target = scanCameraZoom(world.localPlayer.ship, 800, 1094);
    for (let frame = 0; frame <= 72; frame++) {
      canvasManager.easeZoomToward(target, (frame * 1000) / 60);
    }
    canvasManager.beginWorldLayers(ctx);
    const wideViewport = canvasManager.getViewportSize();
    expect(Math.min(wideViewport.width, wideViewport.height) / 2).toBeGreaterThanOrEqual(
      SHIP_ABILITY.SCAN_RANGE
    );
    canvasManager.endWorldLayers(ctx);
    if (mode === 'simple') {
      canvasManager.drawSimpleScan(world, 1200);
    }
    const surface = mode === 'simple' ? drawnSurface(draw) : undefined;
    for (let frame = 1; frame <= 36; frame++) {
      canvasManager.easeZoomToward(1, 1200 + (frame * 1000) / 60);
    }
    expect(canvasManager.usesSimpleScan()).toBe(mode === 'simple');
    for (let frame = 37; frame <= 54; frame++) {
      canvasManager.easeZoomToward(1, 1200 + (frame * 1000) / 60);
    }
    const nativeTransform = ctx.getTransform();
    canvasManager.beginWorldLayers(ctx);
    const viewport = { ...canvasManager.getViewportSize() };
    if (mode === 'simple') {
      expect(viewport).toEqual({ width: 800, height: 1094 });
      expect(ctx.getTransform()).toEqual(nativeTransform);
    } else {
      expect(viewport.width).toBeGreaterThan(800);
    }
    canvasManager.endWorldLayers(ctx);
    expect(canvasManager.usesSimpleScan()).toBe(false);
    expect(canvasManager.readSimpleScanDiagnostics().ownedPixels).toBe(0);
    if (surface) {
      expect({ width: surface.width, height: surface.height }).toEqual({
        width: 0,
        height: 0,
      });
    }
  }
);

test.each([
  { width: 2000, height: 2000, expected: { width: 1000, height: 1000 } },
  { width: 5000, height: 200, expected: { width: 1535, height: 61 } },
])(
  'the Scan raster obeys its pixel and dimension caps for $width by $height',
  ({ width, height, expected }) => {
    const ctx = mount('simple', width, height, 1);
    const draw = vi.spyOn(ctx, 'drawImage');
    scanAt(0);
    canvasManager.drawSimpleScan(scene(), 0);
    const surface = drawnSurface(draw);
    expect({ width: surface.width, height: surface.height }).toEqual(expected);
    expect(surface.width * surface.height).toBeLessThanOrEqual(1_000_000);
    expect(Math.max(surface.width, surface.height)).toBeLessThanOrEqual(1536);
  }
);

test('resizing an active Scan releases the old raster before painting its replacement', () => {
  vi.useFakeTimers();
  const ctx = mount('simple');
  const draw = vi.spyOn(ctx, 'drawImage');
  const world = scene();
  scanAt(0);
  canvasManager.drawSimpleScan(world, 0);
  const first = drawnSurface(draw);

  restoreViewports.push(setWindowViewport(1094, 800, 1.5));
  window.dispatchEvent(new Event('resize'));
  vi.advanceTimersByTime(20);
  expect({ width: first.width, height: first.height }).toEqual({ width: 0, height: 0 });
  expect(canvasManager.readSimpleScanDiagnostics().ownedPixels).toBe(0);
  expect(canvasManager.usesSimpleScan()).toBe(true);
  canvasManager.drawSimpleScan(world, 20);
  const second = drawnSurface(draw);
  expect(second).not.toBe(first);
  expect({ width: second.width, height: second.height }).toEqual({ width: 820, height: 600 });
  expect(canvasManager.getViewportSize()).toEqual({ width: 1094, height: 800 });
});

test('a lost Scan context releases its bitmap before painting on a new bounded canvas', () => {
  const ctx = mount('simple');
  const draw = vi.spyOn(ctx, 'drawImage');
  const world = scene();
  scanAt(0);
  canvasManager.drawSimpleScan(world, 0);
  const first = drawnSurface(draw);
  const firstContext = first.getContext('2d');
  if (!firstContext) {
    throw new Error('Expected the initially available Scan context');
  }
  Object.defineProperty(firstContext, 'isContextLost', { configurable: true, value: () => true });
  canvasManager.drawSimpleScan(world, 16);
  const second = drawnSurface(draw);
  expect(second).not.toBe(first);
  expect({ width: first.width, height: first.height }).toEqual({ width: 0, height: 0 });
  expect(canvasManager.readSimpleScanDiagnostics()).toMatchObject({
    directFallback: false,
    ownedPixels: 492000,
    peakOwnedPixels: 492000,
  });
});

test('a context lost during allocation falls back once and continues drawing live asteroid changes', () => {
  const ctx = mount('simple');
  const originalAllocate = rasterSurface.prepareRasterSurface;
  const allocations = vi
    .spyOn(rasterSurface, 'prepareRasterSurface')
    .mockImplementation((...args) => {
      const allocated = originalAllocate(...args);
      Object.defineProperty(allocated.context, 'isContextLost', {
        configurable: true,
        value: () => true,
      });
      return allocated;
    });
  const asteroid = new Roid({
    id: 'live-fallback-rock',
    position: { x: 100, y: 100 },
    velocity: { x: 0, y: 0 },
    size: 30,
    rotation: 0,
    angularVelocity: 0,
    health: 100,
    maxHealth: 100,
    vertices: 6,
    offsets: [1, 1, 1, 1, 1, 1],
    jaggedness: 0,
  });
  const world = { ...scene(), roids: [asteroid] };
  const composites = vi.spyOn(ctx, 'drawImage');
  scanAt(0);
  canvasManager.drawSimpleScan(world, 0);
  expect(canvasManager.readSimpleScanDiagnostics()).toMatchObject({
    active: true,
    directFallback: true,
    ownedPixels: 0,
    lastFrame: { visibleAsteroids: 1 },
  });
  const allocated = allocations.mock.results[0];
  if (allocated?.type !== 'return') {
    throw new Error('Expected the failed canvas allocation handle');
  }
  expect({ width: allocated.value.canvas.width, height: allocated.value.canvas.height }).toEqual({
    width: 0,
    height: 0,
  });
  asteroid.position = { x: 1_000_000, y: 1_000_000 };
  canvasManager.drawSimpleScan(world, 16);
  expect(canvasManager.readSimpleScanDiagnostics()).toMatchObject({
    lastFrame: { visibleAsteroids: 0 },
  });
  expect(allocations).toHaveBeenCalledTimes(1);
  expect(composites).not.toHaveBeenCalled();
});

test('an unavailable raster context frees the detached allocation before reporting failure', () => {
  const created = vi.spyOn(document, 'createElement');
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValueOnce(null);
  expect(() => rasterSurface.prepareRasterSurface(600, 820, undefined, 'No Scan context')).toThrow(
    'No Scan context'
  );
  const result = created.mock.results[0];
  if (result?.type !== 'return' || !(result.value instanceof HTMLCanvasElement)) {
    throw new Error('Expected the detached raster canvas');
  }
  expect({ width: result.value.width, height: result.value.height }).toEqual({
    width: 0,
    height: 0,
  });
});

test.each(['allocation', 'composition'])(
  'a %s failure keeps the world live directly, avoids frame retries, and recovers on resize',
  (failureAt) => {
    vi.useFakeTimers();
    const ctx = mount('simple');
    const world = scene();
    const allocations = vi.spyOn(rasterSurface, 'prepareRasterSurface');
    const composites = vi.spyOn(ctx, 'drawImage');
    const failure = new Error(`Forced Scan ${failureAt} failure`);
    if (failureAt === 'allocation') {
      allocations.mockImplementationOnce(() => {
        throw failure;
      });
    } else {
      composites.mockImplementationOnce(() => {
        throw failure;
      });
    }
    const directFills = vi.spyOn(ctx, 'fillRect');
    scanAt(0);
    canvasManager.drawSimpleScan(world, 0);
    expect(canvasManager.readSimpleScanDiagnostics()).toMatchObject({
      active: true,
      directFallback: true,
      ownedPixels: 0,
      lastFrame: { visibleAsteroids: 0 },
    });
    expect(directFills).toHaveBeenCalledWith(0, 0, 800, 1094);
    expect(allocations).toHaveBeenCalledTimes(1);
    const firstFills = directFills.mock.calls.length;
    world.localPlayer.ship.position = { x: 10, y: 20 };
    canvasManager.drawSimpleScan(world, 16);
    expect(directFills.mock.calls.length).toBeGreaterThan(firstFills);
    expect(allocations).toHaveBeenCalledTimes(1);
    expect(composites).toHaveBeenCalledTimes(failureAt === 'allocation' ? 0 : 1);
    expect(ctx.getTransform()).toMatchObject({ a: 1.5, d: 1.5, e: 0, f: 0 });

    restoreViewports.push(setWindowViewport(1094, 800, 1.5));
    window.dispatchEvent(new Event('resize'));
    vi.advanceTimersByTime(20);
    canvasManager.drawSimpleScan(world, 36);
    expect(allocations).toHaveBeenCalledTimes(2);
    expect(canvasManager.readSimpleScanDiagnostics()).toMatchObject({
      active: true,
      directFallback: false,
      ownedPixels: 492000,
    });
  }
);

test('forcing full detail never enables the simple route or suspends ordinary terrain prefetch', () => {
  vi.useFakeTimers();
  mount('full');
  ensureTerrain(911, { cx: 0, cy: 0, radius: 100_000 });
  getTerrainContours({ x: 0, y: 0 }, 800);
  expect(builtContourPatchCount()).toBe(1);
  scanAt(0);
  scanAt(400);
  expect(canvasManager.usesSimpleScan()).toBe(false);
  expect(canvasManager.readSimpleScanDiagnostics()).toMatchObject({
    mode: 'full',
    reason: 'forced-full',
    active: false,
    ownedPixels: 0,
  });
  vi.runAllTimers();
  expect(builtContourPatchCount()).toBe(5);
});

test('the forced full game route keeps using detailed terrain instead of the simple painter', () => {
  const ctx = mount('full');
  ensureTerrain(917, { cx: 0, cy: 0, radius: 100_000 });
  vi.stubGlobal('Path2D', TestPath2D);
  const nativeStroke = ctx.stroke.bind(ctx);
  vi.spyOn(ctx, 'stroke').mockImplementation((...args: [] | [Path2D]) => {
    const path = args[0];
    if (!(path instanceof TestPath2D)) {
      Reflect.apply(nativeStroke, ctx, args);
      return;
    }
    ctx.beginPath();
    for (const command of path.commands) {
      ctx[command.kind](command.x, command.y);
    }
    nativeStroke();
  });
  const pilot = createPlayer({
    id: 'full-scan-route',
    name: 'Pilot',
    type: 'local',
    kitId: 'scout',
    position: { x: 1000, y: 1000 },
  });
  pilot.ship.abilityActiveFrames = SHIP_ABILITY.SCAN_FRAMES;
  const simplePaint = vi.spyOn(canvasManager, 'drawSimpleScan');
  const marches = vi.spyOn(contours, 'extractIsoContours');
  const clock = vi.spyOn(performance, 'now').mockReturnValue(0);
  drawGame(pilot, new RoidBelt(), [pilot]);
  clock.mockReturnValue(400);
  drawGame(pilot, new RoidBelt(), [pilot]);
  expect(simplePaint).not.toHaveBeenCalled();
  expect(
    marches.mock.calls.some(
      ([, grid, , bounds]) => grid === 96 && bounds !== undefined && bounds.radius > 2048
    )
  ).toBe(true);
  expect(marches.mock.calls.some(([, grid]) => grid === 32)).toBe(false);
  expect(canvasManager.readSimpleScanDiagnostics()).toMatchObject({
    mode: 'full',
    active: false,
    ownedPixels: 0,
  });
  expect(canvasManager.getViewportSize()).toEqual({ width: 800, height: 1094 });
});

test('Scan cancels queued neighbor work, retains required local geometry across a field replacement, and resumes prefetch on return', () => {
  vi.useFakeTimers();
  mount('simple');
  ensureTerrain(912, { cx: 0, cy: 0, radius: 100_000 });
  const center = { x: 0, y: 0 };
  const first = getTerrainContours(center, 800);
  expect(builtContourPatchCount()).toBe(1);
  scanAt(0);
  vi.runAllTimers();
  expect(builtContourPatchCount()).toBe(1);
  expect(peekBuiltContourPatch({ x: 1024, y: 0 }, 800)).toBeUndefined();
  expect(getTerrainContours(center, 800)).toBe(first);
  vi.runAllTimers();
  expect(builtContourPatchCount()).toBe(1);

  ensureTerrain(913, { cx: 0, cy: 0, radius: 100_000 });
  const replacement = getTerrainContours(center, 800);
  expect(replacement).not.toBe(first);
  expect(builtContourPatchCount()).toBe(1);
  vi.runAllTimers();
  expect(builtContourPatchCount()).toBe(1);
  returnToFlight(0);
  getTerrainContours(center, 800);
  vi.runAllTimers();
  expect(builtContourPatchCount()).toBe(5);
});

test('destroying an active Scan restores terrain prefetch for the next session', () => {
  vi.useFakeTimers();
  mount('simple');
  ensureTerrain(914, { cx: 0, cy: 0, radius: 100_000 });
  scanAt(0);
  getTerrainContours({ x: 0, y: 0 }, 800);
  vi.runAllTimers();
  expect(builtContourPatchCount()).toBe(1);
  canvasManager.destroy();
  getTerrainContours({ x: 0, y: 0 }, 800);
  vi.runAllTimers();
  expect(builtContourPatchCount()).toBe(5);
});

test('camera easing covers equal elapsed time at smooth and stalled frame cadences', () => {
  const target = 0.25;
  function zoomAfter(cadence: readonly number[]) {
    mount('simple');
    canvasManager.easeZoomToward(target, 0);
    for (const now of cadence) {
      canvasManager.easeZoomToward(target, now);
    }
    const ctx = canvasManager.requireContext();
    canvasManager.beginWorldLayers(ctx);
    const zoom = 800 / canvasManager.getViewportSize().width;
    canvasManager.endWorldLayers(ctx);
    canvasManager.destroy();
    return zoom;
  }
  const smooth = zoomAfter(Array.from({ length: 50 }, (_, index) => (index + 1) * 16));
  const stalled = zoomAfter([400, 800]);
  expect(stalled).toBeCloseTo(smooth, 12);
  expect(stalled).toBeCloseTo(target, 2);
});

test('the game route paints the simple world, exact nearby lines and native HUD, and survives an overlay failure', () => {
  const ctx = mount('simple');
  ensureTerrain(915, { cx: 0, cy: 0, radius: 100_000 });
  const center = { x: 1000, y: 1000 };
  const segment = getTerrainContours(center, 800)
    .flatMap((level) => level.segments)
    .find(
      (line) =>
        Math.hypot((line.ax + line.bx) / 2 - center.x, (line.ay + line.by) / 2 - center.y) < 600
    );
  if (!segment) {
    throw new Error('Expected a nearby contour in the fixed seeded field');
  }
  const pilot = createPlayer({
    id: 'live-simple-route',
    name: 'Pilot',
    type: 'local',
    kitId: 'scout',
    position: { x: (segment.ax + segment.bx) / 2, y: (segment.ay + segment.by) / 2 },
  });
  pilot.ship.abilityActiveFrames = SHIP_ABILITY.SCAN_FRAMES;
  const belt = new RoidBelt();
  vi.stubGlobal('Path2D', TestPath2D);
  const clock = vi.spyOn(performance, 'now').mockReturnValue(0);
  const marches = vi.spyOn(contours, 'extractIsoContours');
  const composites = vi.spyOn(ctx, 'drawImage');
  const baseTransform = { a: 1.5, b: 0, c: 0, d: 1.5, e: 0, f: 0 };
  const nativeStroke = ctx.stroke.bind(ctx);
  const overlayTransforms: DOMMatrix[] = [];
  const failure = new Error('Nearby contour paint failed');
  let failOverlay = false;
  vi.spyOn(ctx, 'stroke').mockImplementation((...args: [] | [Path2D]) => {
    const path = args[0];
    if (!(path instanceof TestPath2D)) {
      Reflect.apply(nativeStroke, ctx, args);
      return;
    }
    overlayTransforms.push(ctx.getTransform());
    if (failOverlay) {
      throw failure;
    }
    ctx.beginPath();
    for (const command of path.commands) {
      ctx[command.kind](command.x, command.y);
    }
    nativeStroke();
  });
  const hudTransforms: DOMMatrix[] = [];
  const nativeText = ctx.fillText.bind(ctx);
  vi.spyOn(ctx, 'fillText').mockImplementation((...args) => {
    if (args[0].startsWith('Bank ')) {
      hudTransforms.push(ctx.getTransform());
    }
    Reflect.apply(nativeText, ctx, args);
  });

  drawGame(pilot, belt, [pilot]);
  clock.mockReturnValue(400);
  drawGame(pilot, belt, [pilot]);
  expect(canvasManager.usesSimpleScan()).toBe(true);
  expect(
    composites.mock.calls.some(
      ([source]) =>
        source instanceof HTMLCanvasElement && source.width === 600 && source.height === 820
    )
  ).toBe(true);
  expect(overlayTransforms.some((transform) => transform.a < 1.5)).toBe(true);
  expect(hudTransforms).toHaveLength(2);
  expect(hudTransforms.every((transform) => transform.a === 1.5 && transform.d === 1.5)).toBe(true);
  expect(marches.mock.calls.some(([, grid]) => grid === 32)).toBe(true);
  for (const [, grid, , bounds] of marches.mock.calls) {
    if (grid === 96) {
      expect(bounds?.radius).toBeLessThanOrEqual(2048);
    }
  }
  expect(ctx.getTransform()).toMatchObject(baseTransform);

  failOverlay = true;
  clock.mockReturnValue(416);
  expect(() => drawGame(pilot, belt, [pilot])).toThrow(failure);
  expect(canvasManager.getViewportSize()).toEqual({ width: 800, height: 1094 });
  expect(ctx.getTransform()).toMatchObject(baseTransform);
  failOverlay = false;
  clock.mockReturnValue(432);
  expect(() => drawGame(pilot, belt, [pilot])).not.toThrow();
  expect(hudTransforms).toHaveLength(3);
});

test('a live simple Scan starts and releases spider danger music and the native hunted border without detailed feet', () => {
  const ctx = mount('simple');
  vi.stubGlobal('Path2D', TestPath2D);
  const nativeStroke = ctx.stroke.bind(ctx);
  vi.spyOn(ctx, 'stroke').mockImplementation((...args: [] | [Path2D]) => {
    const path = args[0];
    if (!(path instanceof TestPath2D)) {
      Reflect.apply(nativeStroke, ctx, args);
      return;
    }
    ctx.beginPath();
    for (const command of path.commands) {
      ctx[command.kind](command.x, command.y);
    }
    nativeStroke();
  });
  ensureTerrain(918, { cx: 0, cy: 0, radius: 100_000 });
  const pilot = createPlayer({
    id: 'hunted-simple-pilot',
    name: 'Pilot',
    type: 'local',
    kitId: 'scout',
    position: { x: 0, y: 0 },
  });
  pilot.ship.abilityActiveFrames = SHIP_ABILITY.SCAN_FRAMES;
  const belt = new RoidBelt();
  const feet = vi.spyOn(spiderFeet, 'spiderFootContacts');
  const clock = vi.spyOn(performance, 'now').mockReturnValue(0);
  const nativeBorder = ctx.strokeRect.bind(ctx);
  const borders: Array<{
    box: number[];
    transform: DOMMatrix;
    ink: string | CanvasGradient | CanvasPattern;
    width: number;
  }> = [];
  vi.spyOn(ctx, 'strokeRect').mockImplementation((...box) => {
    borders.push({
      box,
      transform: ctx.getTransform(),
      ink: ctx.strokeStyle,
      width: ctx.lineWidth,
    });
    Reflect.apply(nativeBorder, ctx, box);
  });
  setSpiderField({ spiders: [], nests: [] });
  resetMusicThreats();
  drawGame(pilot, belt, [pilot]);
  expect(isMusicThreatActive()).toBe(false);
  expect(borders).toEqual([]);

  setSpiderField({
    spiders: [
      {
        id: 'pursuing-scan-spider',
        position: { x: 80, y: 40 },
        angle: 0,
        health: 100,
        maxHealth: 100,
        phase: 'hunting',
        targetId: pilot.id,
      },
    ],
    nests: [],
  });
  for (const now of [400, 416]) {
    clock.mockReturnValue(now);
    drawGame(pilot, belt, [pilot]);
    expect(isMusicThreatActive()).toBe(true);
    expect(canvasManager.readSimpleScanDiagnostics().lastFrame?.visibleSpiders).toBe(1);
  }
  expect(borders).toHaveLength(2);
  for (const border of borders) {
    expect(border.box).toEqual([2.5, 2.5, 795, 1089]);
    expect(border.transform).toMatchObject({ a: 1.5, b: 0, c: 0, d: 1.5, e: 0, f: 0 });
    expect(border.ink).toBe('rgba(229, 56, 82, 0.65)');
    expect(border.width).toBe(5);
  }

  // An empty live field does not reset audio itself. The next rendered frame must release it.
  setSpiderField({ spiders: [], nests: [] });
  expect(isMusicThreatActive()).toBe(true);
  clock.mockReturnValue(432);
  drawGame(pilot, belt, [pilot]);
  expect(isMusicThreatActive()).toBe(false);
  expect(canvasManager.readSimpleScanDiagnostics().lastFrame?.visibleSpiders).toBe(0);
  expect(borders).toHaveLength(2);
  expect(feet).not.toHaveBeenCalled();
  expect(canvasManager.getViewportSize()).toEqual({ width: 800, height: 1094 });
});
