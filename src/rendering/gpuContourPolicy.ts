export type GpuContourPolicy = 'auto' | 'canvas';

/** Resolve the diagnostic arm once when the canvas session starts. */
export function resolveGpuContours(search: string): GpuContourPolicy {
  const params = new URLSearchParams(search);
  if (!['1', 'collect'].includes(params.get('performance') ?? '')) {
    return 'auto';
  }
  const requested = params.get('gpuContours');
  if (requested === null || requested === 'auto') {
    return 'auto';
  }
  if (requested === 'canvas') {
    return 'canvas';
  }
  throw new Error('gpuContours must be auto or canvas');
}
