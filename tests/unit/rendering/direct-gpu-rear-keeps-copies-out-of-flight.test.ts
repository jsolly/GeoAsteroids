import { afterEach, expect, test, vi } from 'vitest';
import { FurnaceField } from '../../../shared/furnaceField';
import { ensureTerrain, getTerrainField } from '../../../shared/terrainField';
import { PALETTE } from '../../../src/constants';
import { createPlayer } from '../../../src/entities/player/createPlayer';
import { canvasManager } from '../../../src/rendering/canvasSurface';
import { GpuRearRenderer } from '../../../src/rendering/gpuRearRenderer';
import type { SimpleScanScene } from '../../../src/rendering/simpleScanRenderer';
import { setWindowViewport } from '../../support/viewport';

const originalDpr = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');
const originalTerrain = getTerrainField();
let restoreViewport: (() => void) | undefined;
let renderer: GpuRearRenderer | null = null;
let overlay: HTMLCanvasElement;

afterEach(() => {
  renderer?.destroy();
  renderer = null;
  canvasManager.destroy();
  overlay?.remove();
  history.replaceState(null, '', '/');
  restoreViewport?.();
  restoreViewport = undefined;
  ensureTerrain(originalTerrain.seed, originalTerrain);
  if (originalDpr) {
    Object.defineProperty(window, 'devicePixelRatio', originalDpr);
  }
  vi.restoreAllMocks();
});

/** Only the external GPU driver is substituted. Resource and scene owners execute normally. */
function gpuDriver() {
  const gl = {
    MAX_TEXTURE_SIZE: 0x0d33,
    FRAMEBUFFER_COMPLETE: 0x8cd5,
    ARRAY_BUFFER: 0x8892,
    STATIC_DRAW: 0x88e4,
    FLOAT: 0x1406,
    getParameter: () => 4096,
    getExtension: () => null,
    createShader: () => ({}),
    createProgram: () => ({}),
    getProgramParameter: () => true,
    getUniformLocation: () => ({}),
    createBuffer: () => ({}),
    createVertexArray: () => ({}),
    createTexture: () => ({}),
    createFramebuffer: () => ({}),
    checkFramebufferStatus: () => 0x8cd5,
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    detachShader: vi.fn(),
    deleteShader: vi.fn(),
    deleteBuffer: vi.fn(),
    deleteVertexArray: vi.fn(),
    deleteTexture: vi.fn(),
    deleteFramebuffer: vi.fn(),
    deleteProgram: vi.fn(),
    bindTexture: vi.fn(),
    texParameteri: vi.fn(),
    texImage2D: vi.fn(),
    bindFramebuffer: vi.fn(),
    framebufferTexture2D: vi.fn(),
    viewport: vi.fn(),
    disable: vi.fn(),
    colorMask: vi.fn(),
    clearColor: vi.fn(),
    clear: vi.fn(),
    enable: vi.fn(),
    blendEquation: vi.fn(),
    blendFunc: vi.fn(),
    useProgram: vi.fn(),
    uniform1f: vi.fn(),
    uniform1i: vi.fn(),
    uniform2f: vi.fn(),
    uniform3f: vi.fn(),
    uniform4f: vi.fn(),
    bindVertexArray: vi.fn(),
    bindBuffer: vi.fn(),
    bufferData: vi.fn(),
    enableVertexAttribArray: vi.fn(),
    vertexAttribPointer: vi.fn(),
    vertexAttribDivisor: vi.fn(),
    drawArraysInstanced: vi.fn(),
    drawArrays: vi.fn(),
    activeTexture: vi.fn(),
    pixelStorei: vi.fn(),
  };
  const nativeContext = HTMLCanvasElement.prototype.getContext;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
    this: HTMLCanvasElement,
    contextId: string,
    options?: unknown
  ) {
    return contextId === 'webgl2'
      ? (gl as unknown as WebGL2RenderingContext)
      : nativeContext.call(this, contextId, options);
  });
  overlay = document.createElement('canvas');
  document.body.append(overlay);
  return gl;
}

function scene() {
  return {
    position: { x: 2240, y: 3545 },
    width: 800,
    height: 1094,
    dpr: 1.5,
    scale: 1,
    zoom: 1,
    contours: [{ index: 0, segments: [{ ax: 2200, ay: 3500, bx: 2300, by: 3500 }] }],
    starTiles: [
      [
        { x: 2240, y: 3545, alpha: 0.3 },
        { x: 2290, y: 3580, alpha: 0.4 },
      ],
    ],
    contourTransform: { a: 1.5, b: 0, c: 0, d: 1.5 },
    rearSource: overlay,
    nativeStars: 0,
    nativeStarRects: 0,
  };
}

test('moving the camera reuses local star and contour buffers without full-frame transfers', () => {
  const gl = gpuDriver();
  renderer = GpuRearRenderer.create(overlay, () => undefined, 'direct');
  if (!renderer) {
    throw new Error('Expected direct renderer');
  }
  const frame = scene();
  const context = overlay.getContext('2d');
  if (!context) {
    throw new Error('Expected native foreground');
  }
  overlay.width = 1200;
  overlay.height = 1641;
  context.setTransform(0.75, 0, 0, 0.75, 15, 27);
  context.fillStyle = '#ff0000';
  context.fillRect(0, 0, 100, 100);
  const blit = vi.spyOn(context, 'drawImage');
  expect(renderer.draw(frame)).toBe(true);
  expect(renderer.composeInto(context)).toBe(true);
  expect(context.getTransform().a).toBe(0.75);
  expect(context.getTransform().e).toBe(15);
  expect(Array.from(context.getImageData(20, 30, 1, 1).data)).toEqual([0, 0, 0, 0]);
  expect(blit).not.toHaveBeenCalled();
  expect(gl.texImage2D).toHaveBeenCalledTimes(1);
  expect(gl.texImage2D.mock.calls[0]?.at(-1)).toBeNull();
  expect(renderer.getStats()).toMatchObject({
    workload: 'direct-rear-gpu-stars-contours',
    submittedStars: 2,
    submittedSegments: 1,
    geometryUploads: 2,
    retainedBuffers: 2,
    rearTextureBytes: 0,
    rearTextureUploads: 0,
    rearTextureUploadBytes: 0,
    rearBlits: 0,
    directCompositions: 1,
  });
  frame.position = { x: 2241, y: 3546 };
  expect(renderer.draw(frame)).toBe(true);
  expect(renderer.composeInto(context)).toBe(true);
  expect(renderer.getStats()).toMatchObject({
    geometryUploads: 0,
    uploadedBytes: 0,
    retainedBuffers: 2,
  });
  expect(gl.bufferData).toHaveBeenCalledTimes(2);
  expect(gl.texImage2D).toHaveBeenCalledTimes(1);
  frame.starTiles = [[{ x: 3000, y: 4000, alpha: 0.5 }]];
  frame.contours = [{ index: 0, segments: [{ ax: 3000, ay: 4000, bx: 3010, by: 4000 }] }];
  expect(renderer.draw(frame)).toBe(true);
  expect(renderer.getStats()).toMatchObject({ retainedBuffers: 2, retainedBytes: 28 });
  expect(gl.deleteBuffer).toHaveBeenCalledTimes(2);
  expect(gl.deleteVertexArray).toHaveBeenCalledTimes(2);
  expect(overlay.previousElementSibling?.id).toBe('gameGpuCanvas');
});

test('loss hides the rear layer, restores an opaque Canvas background, and rebuilds buffers', () => {
  const gl = gpuDriver();
  history.replaceState(null, '', '/?renderer=webgl2-direct');
  Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1.5 });
  canvasManager.initialize(overlay);
  const stars = [[{ x: 0, y: 0, alpha: 0.4 }]];
  const contours = [{ index: 0, segments: [{ ax: -20, ay: 0, bx: 20, by: 0 }] }];
  const draw = () =>
    canvasManager.drawGpuRear({ position: { x: 0, y: 0 }, contours, starTiles: stars });
  expect(draw()).toBe(true);
  expect(canvasManager.composeGpuRear(canvasManager.requireContext())).toBe(true);
  expect(canvasManager.getRendererBackend()).toBe('webgl2-direct');
  const rear = document.querySelector<HTMLCanvasElement>('#gameGpuCanvas');
  if (!rear) {
    throw new Error('Expected rear layer');
  }
  expect(rear.hidden).toBe(false);
  rear.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
  expect(rear.hidden).toBe(true);
  expect(canvasManager.getRendererBackend()).toBe('canvas');
  expect(draw()).toBe(false);
  canvasManager.clearPlayfield();
  const context = canvasManager.requireContext();
  const color = PALETTE.BG.slice(1)
    .match(/../gu)
    ?.map((channel) => Number.parseInt(channel, 16));
  expect(Array.from(context.getImageData(0, 0, 1, 1).data)).toEqual([...(color ?? []), 255]);
  expect(canvasManager.getGpuFrameStats()).toMatchObject({
    retainedBuffers: 0,
    directCompositions: 0,
  });
  rear.dispatchEvent(new Event('webglcontextrestored'));
  expect(draw()).toBe(true);
  expect(canvasManager.composeGpuRear(context)).toBe(true);
  expect(canvasManager.getGpuFrameStats()).toMatchObject({
    contextLosses: 1,
    contextRestorations: 1,
    geometryUploads: 2,
  });
  expect(gl.bufferData).toHaveBeenCalledTimes(4);
  canvasManager.destroy();
  expect(document.querySelector('#gameGpuCanvas')).toBeNull();
  expect(overlay.dataset['gpuPresentation']).toBeUndefined();
});

test('scan zoom keeps the native foreground transform and uses native hairlines after resize', () => {
  gpuDriver();
  const width = vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(800);
  const height = vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(1094);
  const resizeFrames: FrameRequestCallback[] = [];
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    resizeFrames.push(callback);
    return resizeFrames.length;
  });
  history.replaceState(null, '', '/?renderer=webgl2-direct');
  Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1.5 });
  canvasManager.initialize(overlay);
  for (let now = 0; now <= 3000; now += 100) {
    canvasManager.easeZoomToward(0.5, now);
  }
  const screen = { ...canvasManager.getViewportSize() };
  const context = canvasManager.requireContext();
  canvasManager.beginWorldLayers(context);
  const transform = context.getTransform();
  expect(transform.a).toBe(0.75);
  expect(canvasManager.getViewportSize()).toEqual({
    width: screen.width * 2,
    height: screen.height * 2,
  });
  const frame = scene();
  expect(canvasManager.drawGpuRear(frame)).toBe(true);
  expect(canvasManager.composeGpuRear(context)).toBe(true);
  expect(context.getTransform().a).toBe(transform.a);
  expect(context.getTransform().e).toBe(transform.e);
  expect(context.getTransform().f).toBe(transform.f);
  expect(canvasManager.requiresNativeGpuContours()).toBe(true);
  canvasManager.recordNativeGpuContours(1);
  expect(canvasManager.getGpuFrameStats()).toMatchObject({
    contourMode: 'canvas-path',
    nativeContourSegments: 1,
    submittedSegments: 0,
    submittedStars: 2,
    directCompositions: 1,
  });
  canvasManager.endWorldLayers(context);
  expect(canvasManager.getViewportSize()).toEqual(screen);
  expect(context.getTransform().a).toBe(1.5);
  const rear = document.querySelector<HTMLCanvasElement>('#gameGpuCanvas');
  expect(rear?.width).toBe(overlay.width);
  expect(rear?.height).toBe(overlay.height);
  expect(rear?.style.width).toBe(overlay.style.width);
  expect(rear?.style.height).toBe(overlay.style.height);
  width.mockReturnValue(1024);
  height.mockReturnValue(768);
  window.dispatchEvent(new Event('resize'));
  expect(resizeFrames).toHaveLength(1);
  resizeFrames.shift()?.(0);
  expect(canvasManager.getViewportSize()).toEqual({ width: 1024, height: 768 });
  expect(overlay.width).toBe(1536);
  expect(overlay.height).toBe(1152);
  expect(rear?.width).toBe(1536);
  expect(rear?.height).toBe(1152);
  canvasManager.beginWorldLayers(context);
  expect(canvasManager.drawGpuRear(frame)).toBe(true);
  expect(canvasManager.composeGpuRear(context)).toBe(true);
  const world = canvasManager.getViewportSize();
  const resizedTransform = context.getTransform();
  expect(resizedTransform.a * world.width + resizedTransform.e).toBe(1536);
  expect(resizedTransform.d * world.height + resizedTransform.f).toBe(1152);
  canvasManager.endWorldLayers(context);
});

test.each(['available', 'restored'] as const)(
  'a simple Scan hides its preceding GPU frame and returns to the %s GPU without copies',
  (gpuState) => {
    const gl = gpuDriver();
    restoreViewport = setWindowViewport(800, 1094, 1.5);
    history.replaceState(
      null,
      '',
      '/?performance=collect&renderer=webgl2-direct&scanDetail=simple'
    );
    canvasManager.initialize(overlay);
    const context = canvasManager.requireContext();
    const rearScene = scene();
    const drawRear = () => {
      expect(canvasManager.drawGpuRear(rearScene)).toBe(true);
      expect(canvasManager.composeGpuRear(context)).toBe(true);
    };
    drawRear();
    const rear = document.querySelector<HTMLCanvasElement>('#gameGpuCanvas');
    if (!rear) {
      throw new Error('Expected the composed rear surface');
    }
    expect(rear.hidden).toBe(false);
    const submittedBeforeScan = gl.drawArraysInstanced.mock.calls.length;
    const transfersBeforeScan = gl.texImage2D.mock.calls.length;
    const world: SimpleScanScene = {
      localPlayer: createPlayer({
        id: 'gpu-scan-pilot',
        name: 'Pilot',
        type: 'local',
        kitId: 'scout',
        position: { x: 2240, y: 3545 },
      }),
      players: [],
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
      terrain: ensureTerrain(737, { cx: 0, cy: 0, radius: 10_000 }),
      furnaces: new FurnaceField(),
      exploration: [],
    };
    const composites = vi.spyOn(context, 'drawImage');
    canvasManager.easeZoomToward(0.25, 0);
    canvasManager.drawSimpleScan(world, 0);
    expect(canvasManager.usesSimpleScan()).toBe(true);
    expect(rear.hidden).toBe(true);
    expect(canvasManager.getRendererBackend()).toBe('canvas');
    const scanSurface = composites.mock.calls.at(-1)?.[0];
    if (!(scanSurface instanceof HTMLCanvasElement)) {
      throw new Error('Expected the live Simple Scan raster');
    }
    expect({ width: scanSurface.width, height: scanSurface.height }).toEqual({
      width: 600,
      height: 820,
    });

    if (gpuState === 'restored') {
      rear.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
      expect(canvasManager.canDrawGpuRear()).toBe(false);
      expect(canvasManager.drawGpuRear(rearScene)).toBe(false);
      rear.dispatchEvent(new Event('webglcontextrestored'));
      expect(canvasManager.canDrawGpuRear()).toBe(true);
      expect(rear.hidden).toBe(true);
    }
    for (const now of [100, 400, 800]) {
      canvasManager.easeZoomToward(0.25, now);
      canvasManager.drawSimpleScan(world, now);
      expect(rear.hidden).toBe(true);
      expect(composites.mock.calls.at(-1)?.[0]).toBe(scanSurface);
    }
    expect(gl.drawArraysInstanced).toHaveBeenCalledTimes(submittedBeforeScan);
    // Restored GPU resources stay unallocated while Simple Scan owns the view.
    expect(gl.texImage2D).toHaveBeenCalledTimes(transfersBeforeScan);

    for (let step = 1; step <= 12; step++) {
      canvasManager.easeZoomToward(1, 800 + step * 100);
    }
    expect(canvasManager.usesSimpleScan()).toBe(false);
    expect(canvasManager.readSimpleScanDiagnostics().ownedPixels).toBe(0);
    expect({ width: scanSurface.width, height: scanSurface.height }).toEqual({
      width: 0,
      height: 0,
    });
    composites.mockClear();
    drawRear();
    expect(rear.hidden).toBe(false);
    expect(canvasManager.getRendererBackend()).toBe('webgl2-direct');
    expect(composites).not.toHaveBeenCalled();
    // Flight allocates only a fresh empty coverage mask after context restoration.
    expect(gl.texImage2D).toHaveBeenCalledTimes(
      transfersBeforeScan + Number(gpuState === 'restored')
    );
    for (const call of gl.texImage2D.mock.calls) {
      expect(call.at(-1)).toBeNull();
    }
    expect(canvasManager.getGpuFrameStats()).toMatchObject({
      rearTextureUploads: 0,
      rearTextureUploadBytes: 0,
      rearBlits: 0,
      directCompositions: 1,
      submittedStars: 2,
      submittedSegments: 1,
      contextLosses: gpuState === 'restored' ? 1 : 0,
      contextRestorations: gpuState === 'restored' ? 1 : 0,
    });
  }
);
