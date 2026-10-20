import { afterEach, expect, test, vi } from 'vitest';
import { canvasManager } from '../../../src/rendering/canvasSurface';
import { GpuRearRenderer } from '../../../src/rendering/gpuRearRenderer';
import { GpuResources } from '../../../src/rendering/gpuResources';
import { logger } from '../../../src/utils/Logger';

let renderer: GpuRearRenderer | null = null;
let overlay: HTMLCanvasElement;

afterEach(() => {
  renderer?.destroy();
  renderer = null;
  canvasManager.destroy();
  overlay?.remove();
  history.replaceState(null, '', '/');
  vi.restoreAllMocks();
});

function createRenderer() {
  const gl = {
    MAX_TEXTURE_SIZE: 0x0d33,
    getParameter: () => 4096,
    getExtension: () => null,
  };
  overlay = document.createElement('canvas');
  document.body.append(overlay);
  const getContext = HTMLCanvasElement.prototype.getContext;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
    this: HTMLCanvasElement,
    contextId: string,
    options?: unknown
  ) {
    // GPU driver boundary only; the renderer and native Canvas remain real.
    return contextId === 'webgl2'
      ? (gl as unknown as WebGL2RenderingContext)
      : getContext.call(this, contextId, options);
  });
  vi.spyOn(GpuResources.prototype, 'program').mockReturnValue({});
  vi.spyOn(GpuResources.prototype, 'uniform').mockReturnValue({});
  vi.spyOn(GpuResources.prototype, 'vertexArray').mockReturnValue({});
  vi.spyOn(GpuResources.prototype, 'texture').mockReturnValue({});
  vi.spyOn(GpuResources.prototype, 'framebuffer').mockReturnValue({});
  const destroy = vi.spyOn(GpuResources.prototype, 'destroy').mockImplementation(() => undefined);
  const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
  return { destroy, error };
}

test('a GPU allocation failure rejects the renderer and reports its cause', () => {
  const vertex: WebGLShader = {};
  const fragment: WebGLShader = {};
  const deleteShader = vi.fn<(shader: WebGLShader) => void>();
  const gl = {
    MAX_TEXTURE_SIZE: 0x0d33,
    VERTEX_SHADER: 0x8b31,
    FRAGMENT_SHADER: 0x8b30,
    getParameter: () => 4096,
    getExtension: () => null,
    createShader: vi.fn().mockReturnValueOnce(vertex).mockReturnValueOnce(fragment),
    shaderSource: () => undefined,
    compileShader: () => undefined,
    createProgram: () => null,
    deleteShader,
  };
  overlay = document.createElement('canvas');
  document.body.append(overlay);
  const getContext = HTMLCanvasElement.prototype.getContext;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
    this: HTMLCanvasElement,
    contextId: string,
    options?: unknown
  ) {
    return contextId === 'webgl2'
      ? (gl as unknown as WebGL2RenderingContext)
      : getContext.call(this, contextId, options);
  });
  const destroy = vi.spyOn(GpuResources.prototype, 'destroy');
  const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
  const failure = new Error('GPU could not allocate program');
  renderer = GpuRearRenderer.create(overlay, () => undefined);
  expect(renderer).toBeNull();
  expect(document.querySelector('#gameGpuCanvas')).toBeNull();
  expect(destroy).toHaveBeenCalledOnce();
  expect(deleteShader).toHaveBeenCalledTimes(2);
  expect(deleteShader.mock.calls.filter(([shader]) => shader === vertex)).toHaveLength(1);
  expect(deleteShader.mock.calls.filter(([shader]) => shader === fragment)).toHaveLength(1);
  expect(error).toHaveBeenCalledExactlyOnceWith(
    'RENDER',
    'GPU initialization failed; using Canvas',
    expect.objectContaining({ name: 'Error', message: failure.message })
  );
});

test('an oversized GPU frame retires its resources and reports the failed draw once', () => {
  const { destroy, error } = createRenderer();
  renderer = GpuRearRenderer.create(overlay, () => undefined);
  expect(renderer).not.toBeNull();
  const scene = {
    position: { x: 0, y: 0 },
    width: 4097,
    height: 10,
    dpr: 1,
    scale: 1,
    zoom: 1,
    contours: [],
    starTiles: [],
    rearSource: overlay,
    contourTransform: { a: 1, b: 0, c: 0, d: 1 },
    nativeStars: 0,
    nativeStarRects: 0,
  };
  expect(renderer?.draw(scene)).toBe(false);
  expect(renderer?.available()).toBe(false);
  expect(renderer?.getStats().state).toBe('failed');
  expect(destroy).toHaveBeenCalledOnce();
  expect(error).toHaveBeenCalledExactlyOnceWith(
    'RENDER',
    'GPU drawing failed; using Canvas',
    expect.objectContaining({ message: 'GPU viewport exceeds the supported texture size' })
  );
  expect(renderer?.draw(scene)).toBe(false);
  expect(error).toHaveBeenCalledOnce();
});

test('a failed GPU blit restores the Canvas transform and reports the retired renderer', () => {
  const { destroy, error } = createRenderer();
  renderer = GpuRearRenderer.create(overlay, () => undefined);
  const context = overlay.getContext('2d');
  if (!context || !renderer) {
    throw new Error('Expected renderer and Canvas context');
  }
  context.translate(12, 34);
  const failure = new Error('Blit failed');
  vi.spyOn(context, 'drawImage').mockImplementation(() => {
    throw failure;
  });
  expect(renderer.composeInto(context)).toBe(false);
  expect(renderer.available()).toBe(false);
  expect(context.getTransform().e).toBe(12);
  expect(context.getTransform().f).toBe(34);
  expect(destroy).toHaveBeenCalledOnce();
  expect(error).toHaveBeenCalledExactlyOnceWith(
    'RENDER',
    'GPU composition failed; using Canvas',
    expect.objectContaining({ name: 'Error', message: failure.message })
  );
});

test('a failed GPU factory leaves the primary Canvas usable and reports the cause', () => {
  overlay = document.createElement('canvas');
  document.body.append(overlay);
  history.replaceState(null, '', '/?renderer=webgl2');
  const failure = new Error('GPU creation failed');
  vi.spyOn(GpuRearRenderer, 'create').mockImplementation(() => {
    throw failure;
  });
  const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
  canvasManager.initialize(overlay);
  const context = canvasManager.requireContext();
  context.fillStyle = '#ff0000';
  context.fillRect(0, 0, 1, 1);
  expect(Array.from(context.getImageData(0, 0, 1, 1).data)).toEqual([255, 0, 0, 255]);
  expect(error).toHaveBeenCalledExactlyOnceWith(
    'RENDER',
    'GPU creation failed; using Canvas',
    expect.objectContaining({ name: 'Error', message: failure.message })
  );
});
