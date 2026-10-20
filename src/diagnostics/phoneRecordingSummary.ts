import type { DebugJsonValue } from '../../shared-types';

type Recording = {
  id: string;
  metadata: { startedAt: string; device: string; conditions: string };
  incompleteReason: string | null;
  samples: readonly string[];
  stopped: boolean;
  recovered: boolean;
};
type Aggregate = {
  count: number;
  sum: number;
  max: number;
  omittedSamples: number;
  over33Ms: number;
  values: number[];
};
const PHASES = ['menu', 'play', 'respawn', 'hidden'];
const COUNTER_NAME = /^[a-zA-Z]{1,64}$/u;
const FRAME_INTERVAL_METRICS = new Set([
  'frameIntervalMs',
  'scanFrameIntervalMs',
  'flightFrameIntervalMs',
  'scanEnterFrameIntervalMs',
  'scanWideFrameIntervalMs',
  'scanReturnFrameIntervalMs',
  'unclassifiedFrameIntervalMs',
]);
const METRICS = new Set([
  ...FRAME_INTERVAL_METRICS,
  'updateMs',
  'renderMs',
  'frameCpuMs',
  'scanUpdateMs',
  'scanRenderMs',
  'scanFrameCpuMs',
  'scanParseMs',
  'scanKeyframeDecodeMs',
  'scanDeltaDecodeMs',
  'scanApplyMs',
  'scanSceneryBuildMs',
  'simpleScanRasterBuildMs',
  'simpleScanTerrainBuildMs',
  'inputToRenderMs',
  'rttMs',
  'messageGapMs',
  'collectionGapMs',
  'parseMs',
  'keyframeDecodeMs',
  'deltaDecodeMs',
  'applyMs',
]);
const GRAPHICS_KEYS = [
  'deviceDpr',
  'effectiveDpr',
  'maxDpr',
  'glow',
  'source',
  'touchControls',
  'cssWidth',
  'cssHeight',
  'backingWidth',
  'backingHeight',
  'gpuContours',
  'scanScenery',
  'scanSceneryMaxPixels',
  'deviceCategory',
  'scanDetail',
  'scanDetailReason',
  'scanDeviceMemory',
  'scanLogicalCores',
  'simpleScanDprCap',
  'simpleScanPixelCap',
];
const SLOW_FRAME_LIMIT = 16;
const SCENERY_FALLBACK_REASONS = [
  'source',
  'coverage',
  'pixel-limit',
  'dimension-limit',
  'allocation',
  'paint',
  'composite',
  'unsupported',
  'backend',
  'disabled',
];

function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid recording object');
  }
  return Object.fromEntries(Object.entries(value));
}

function number(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error('Invalid recording number');
  }
  return value;
}

function count(value: unknown): number {
  const result = number(value);
  if (!Number.isSafeInteger(result)) {
    throw new Error('Invalid recording count');
  }
  return result;
}

function settings(value: unknown): Record<string, DebugJsonValue> {
  const result: Record<string, DebugJsonValue> = {};
  const input = object(value);
  for (const key of GRAPHICS_KEYS) {
    const child = input[key];
    if (child === undefined) {
      continue;
    }
    if (typeof child === 'string') {
      result[key] = child.slice(0, 512);
    } else if (typeof child === 'boolean') {
      result[key] = child;
    } else {
      result[key] = number(child);
    }
  }
  return result;
}

function text(value: unknown, limit: number): string {
  if (typeof value !== 'string') {
    throw new Error('Missing recording provenance');
  }
  return value.slice(0, limit);
}

function sceneryFrame(value: unknown): Record<string, DebugJsonValue> {
  const row = object(value);
  const kind = row['kind'];
  if (kind === 'native' || kind === 'cached') {
    return { kind };
  }
  if (kind === 'built' && (row['cause'] === 'cold' || row['cause'] === 'pan')) {
    return { kind, cause: row['cause'] };
  }
  if (
    kind === 'fallback' &&
    typeof row['reason'] === 'string' &&
    SCENERY_FALLBACK_REASONS.includes(row['reason'])
  ) {
    return { kind, reason: row['reason'] };
  }
  throw new Error('Invalid scenery frame');
}

function previousFrame(value: unknown) {
  if (value === null) {
    return null;
  }
  const row = object(value);
  const stage = row['stage'];
  if (stage !== 'flight' && stage !== 'enter' && stage !== 'wide' && stage !== 'return') {
    throw new Error('Invalid scan stage');
  }
  return {
    stage,
    scenery: sceneryFrame(row['scenery']),
    visibleSpiders: count(row['visibleSpiders']),
    updateMs: number(row['updateMs']),
    renderMs: number(row['renderMs']),
    frameCpuMs: number(row['frameCpuMs']),
  };
}

function slowFrame(value: unknown) {
  const row = object(value);
  const intervalMs = number(row['intervalMs']);
  if (intervalMs <= 25) {
    throw new Error('Invalid slow-frame interval');
  }
  return {
    atMs: number(row['atMs']),
    intervalMs,
    previousFrame: previousFrame(row['previousFrame']),
  };
}

/** Reads existing chunks only when a report opens. Recording and raw exports stay untouched. */
export function summarizePhoneRecording(recording: Recording): Record<string, DebugJsonValue> {
  const reasons = new Set<string>();
  if (!recording.stopped) {
    reasons.add('Recording has not been stopped');
  }
  if (recording.incompleteReason !== null && recording.incompleteReason !== '') {
    reasons.add(recording.incompleteReason.slice(0, 256));
  }
  if (recording.samples.length === 0) {
    reasons.add('No recorded samples');
  }
  const aggregates = new Map<string, Aggregate>();
  const phaseDurations: Record<string, DebugJsonValue> = {};
  const counters: Record<string, DebugJsonValue> = {};
  let durationMs = 0;
  let provenance: Record<string, DebugJsonValue> | null = null;
  let provenanceKey = '';
  const rendererFrames = { canvas: 0, webgl2: 0, 'webgl2-direct': 0 };
  const slowFrames: ReturnType<typeof slowFrame>[] = [];
  let slowFrameChunks = 0;
  let observedSlowIntervals = 0;
  for (const serialized of recording.samples) {
    const sample = object(JSON.parse(serialized));
    durationMs += number(sample['durationMs']);
    const phases = object(sample['phaseDurationsMs']);
    for (const phase of PHASES) {
      phaseDurations[phase] = number(number(phaseDurations[phase] ?? 0) + number(phases[phase]));
    }
    const renderer = object(sample['renderer']);
    const frames = object(renderer['frames']);
    const chunkFrames = {
      canvas: count(frames['canvas']),
      webgl2: count(frames['webgl2']),
      // Persisted recordings made before the direct renderer have no direct ledger.
      'webgl2-direct': frames['webgl2-direct'] === undefined ? 0 : count(frames['webgl2-direct']),
    };
    for (const backend of ['canvas', 'webgl2', 'webgl2-direct'] as const) {
      rendererFrames[backend] = count(rendererFrames[backend] + chunkFrames[backend]);
    }
    const sampleCounters = object(sample['counters']);
    const graphics = settings(sample['graphicsSettings']);
    const requested = text(renderer['requested'], 32);
    const backend = text(renderer['backend'], 32);
    if (requested === 'webgl2-direct') {
      if (
        graphics['gpuContours'] === 'canvas' &&
        (count(sampleCounters['gpuNativeContourFrames'] ?? 0) !== chunkFrames['webgl2-direct'] ||
          count(sampleCounters['gpuCapsuleContourFrames'] ?? 0) !== 0)
      ) {
        reasons.add('Forced native GPU contours do not match successful direct frames');
      }
      const simpleScanFrames =
        sampleCounters['simpleScanFrames'] === undefined
          ? 0
          : count(sampleCounters['simpleScanFrames']);
      // Simple Scan deliberately paints Canvas; every other completed frame must remain direct.
      if (
        chunkFrames.canvas !== simpleScanFrames ||
        chunkFrames.webgl2 !== 0 ||
        (backend !== 'canvas' && backend !== 'webgl2-direct')
      ) {
        reasons.add('Direct GPU recording contains unplanned renderer fallback');
      }
      if (renderer['gpuStats'] !== null && renderer['gpuStats'] !== undefined) {
        const gpu = object(renderer['gpuStats']);
        if (text(gpu['state'], 32) !== 'ready') {
          reasons.add('Direct GPU renderer was unavailable during recording');
        }
        if (count(gpu['contextLosses']) > 0 || count(gpu['contextRestorations']) > 0) {
          reasons.add('Direct GPU recording contains GPU context interruption history');
        }
      }
    }
    if (sample['slowFrames'] !== undefined) {
      const context = object(sample['slowFrames']);
      const observed = count(context['observedCount']);
      const values = context['values'];
      if (
        context['limit'] !== SLOW_FRAME_LIMIT ||
        !Array.isArray(values) ||
        values.length !== Math.min(observed, SLOW_FRAME_LIMIT)
      ) {
        throw new Error('Invalid slow-frame selection');
      }
      slowFrameChunks++;
      observedSlowIntervals = count(observedSlowIntervals + observed);
      for (const value of values) {
        slowFrames.push(slowFrame(value));
        slowFrames.sort(
          (left, right) => right.intervalMs - left.intervalMs || left.atMs - right.atMs
        );
        slowFrames.length = Math.min(SLOW_FRAME_LIMIT, slowFrames.length);
      }
    }
    const current = {
      clientReleaseId: text(sample['clientReleaseId'], 128),
      serverReleaseId: text(sample['serverReleaseId'], 128),
      graphics,
      rendererRequested: requested,
      // The observed frame ledgers below describe the intentional direct/Canvas hybrid.
      rendererBackend: requested === 'webgl2-direct' ? requested : backend,
    };
    const currentProvenanceKey = JSON.stringify(current);
    if (provenance === null) {
      provenance = current;
      provenanceKey = currentProvenanceKey;
    } else if (currentProvenanceKey !== provenanceKey) {
      reasons.add('Release, graphics, or renderer changed during recording');
    }
    for (const [key, value] of Object.entries(sampleCounters)) {
      if (!COUNTER_NAME.test(key)) {
        throw new Error('Invalid counter');
      }
      if (['__proto__', 'constructor', 'prototype'].includes(key)) {
        throw new Error('Invalid counter');
      }
      counters[key] = count(number(counters[key] ?? 0) + count(value));
      if (Object.keys(counters).length > 64) {
        throw new Error('Too many counters');
      }
    }
    for (const [key, value] of Object.entries(object(sample['metrics']))) {
      const [phase, metric] = key.split('.');
      if (
        !phase ||
        !metric ||
        key !== `${phase}.${metric}` ||
        !PHASES.includes(phase) ||
        !METRICS.has(metric)
      ) {
        continue;
      }
      const row = object(value);
      const values = row['values'];
      if (!Array.isArray(values) || values.length > 4096) {
        throw new Error('Invalid samples');
      }
      const rowCount = count(row['count']);
      const omitted = count(row['omittedSamples']);
      if (rowCount !== values.length + omitted) {
        throw new Error('Missing samples');
      }
      const aggregate = aggregates.get(key) ?? {
        count: 0,
        sum: 0,
        max: 0,
        omittedSamples: 0,
        over33Ms: 0,
        values: [],
      };
      aggregate.count += rowCount;
      aggregate.sum += number(row['sum']);
      aggregate.max = Math.max(aggregate.max, number(row['max']));
      aggregate.omittedSamples += omitted;
      aggregate.over33Ms += count(row['over33Ms']);
      for (const raw of values) {
        aggregate.values.push(number(raw));
      }
      aggregates.set(key, aggregate);
      if (omitted > 0) {
        reasons.add('Raw metric samples omitted');
      }
    }
    if (object(sample['appliedSnapshots'])['omittedSamples'] !== 0) {
      reasons.add('Applied snapshot samples omitted');
    }
  }
  if ((aggregates.get('play.frameIntervalMs')?.count ?? 0) === 0) {
    reasons.add('No gameplay frame samples');
  }
  if (provenance?.['rendererRequested'] === 'webgl2-direct') {
    if (rendererFrames['webgl2-direct'] === 0) {
      reasons.add('No direct GPU frames observed during recording');
    }
    const observedBackends = Object.entries(rendererFrames)
      .filter(([, frames]) => frames > 0)
      .map(([backend]) => backend);
    provenance['rendererBackend'] =
      observedBackends.length > 1 ? 'mixed' : (observedBackends[0] ?? 'unobserved');
  }
  const complete = reasons.size === 0;
  const metrics: Record<string, DebugJsonValue> = {};
  for (const [key, aggregate] of aggregates) {
    const sorted = complete ? aggregate.values.toSorted((a, b) => a - b) : [];
    const percentile = (fraction: number) =>
      sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] ?? null;
    metrics[key] = {
      count: count(aggregate.count),
      retainedCount: aggregate.values.length,
      omittedSamples: count(aggregate.omittedSamples),
      sum: number(aggregate.sum),
      mean: aggregate.count > 0 ? aggregate.sum / aggregate.count : null,
      max: aggregate.max,
      p50: percentile(0.5),
      p95: percentile(0.95),
      p99: percentile(0.99),
      over25Ms: complete ? sorted.filter((value) => value > 25).length : null,
      over33Ms: count(aggregate.over33Ms),
      framesPerSecond:
        FRAME_INTERVAL_METRICS.has(key.substring(key.indexOf('.') + 1)) && aggregate.sum > 0
          ? number((1000 * aggregate.count) / aggregate.sum)
          : null,
    };
  }
  const frameCoverageByPhase: Record<string, DebugJsonValue> = {};
  for (const phase of PHASES) {
    const frames = aggregates.get(`${phase}.frameIntervalMs`);
    const phaseDurationMs = number(phaseDurations[phase] ?? 0);
    const completedFrameCount = frames?.count ?? 0;
    const intervalCoverageMs = frames?.sum ?? 0;
    frameCoverageByPhase[phase] = {
      completedFrameCount,
      intervalCoverageMs,
      phaseDurationMs,
      intervalCoverageRatio:
        phaseDurationMs > 0 ? number(intervalCoverageMs / phaseDurationMs) : null,
      fullWindowFramesPerSecond:
        phaseDurationMs > 0 ? number((1000 * completedFrameCount) / phaseDurationMs) : null,
    };
  }
  return {
    schemaVersion: 1,
    source: 'phone-collector',
    sessionId: recording.id.slice(0, 128),
    startedAt: recording.metadata.startedAt.slice(0, 40),
    device: recording.metadata.device.slice(0, 256),
    conditions: recording.metadata.conditions.slice(0, 512),
    stopped: recording.stopped,
    recovered: recording.recovered,
    complete,
    incompleteReasons: [...reasons],
    sampleChunkCount: recording.samples.length,
    durationMs: number(durationMs),
    phaseDurationsMs: phaseDurations,
    frameCoverageByPhase,
    frameRateBasis:
      'Metric framesPerSecond uses completed frame intervals; fullWindowFramesPerSecond uses the whole declared phase duration',
    provenance,
    rendererFrames,
    counters,
    slowFrameContext: {
      availability:
        slowFrameChunks === 0
          ? 'unavailable'
          : slowFrameChunks === recording.samples.length
            ? 'complete'
            : 'partial',
      chunksWithContext: slowFrameChunks,
      observedSlowIntervals,
      selectionLimit: SLOW_FRAME_LIMIT,
      selection:
        'Largest recorded intervals over 25 ms; CPU, scan stage, scenery and spiders belong to the preceding completed render. This is not a complete event timeline or GPU timing.',
      values: slowFrames,
    },
    metrics,
    rawSamples: 'Retained locally; this report contains summaries only',
  };
}
