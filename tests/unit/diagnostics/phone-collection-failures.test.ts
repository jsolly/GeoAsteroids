import { Blob } from 'node:buffer';
import { createHash, webcrypto } from 'node:crypto';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { parseDebugReportSubmission, sanitizeDebugDiagnostics } from '../../../shared/debugReports';
import { ClientPerformanceMetrics } from '../../../src/diagnostics/performanceMetrics';
import { createPhoneCollector } from '../../../src/diagnostics/phoneCollector';
import { installPhoneRecordingStorage as storage } from '../../support/phoneRecordingStorage';

const collectors = new Set<ReturnType<typeof createPhoneCollector>>();
beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto);
  vi.stubGlobal('Blob', Blob);
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'performance', 'Date'] });
});
afterEach(() => {
  for (const subject of collectors) {
    subject.dispose();
  }
  collectors.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function collector(metrics = new ClientPerformanceMetrics(true), changed = vi.fn()) {
  const result = createPhoneCollector(metrics, changed);
  collectors.add(result);
  return result;
}

async function artifact(subject: ReturnType<typeof createPhoneCollector>) {
  const result = await subject.download();
  if (!result) {
    throw new Error('Missing download');
  }
  const envelope = JSON.parse(await result.blob.text());
  expect(envelope.checksumAlgorithm).toBe('SHA-256');
  expect(envelope.checksum).toBe(createHash('sha256').update(envelope.content).digest('hex'));
  return { result, content: JSON.parse(envelope.content) };
}

test('opening collection leaves benchmark samples undrained until Start and unavailable storage reports incomplete', async () => {
  const metrics = new ClientPerformanceMetrics(true);
  metrics.record('renderMs', 3);
  const subject = collector(metrics);
  expect(metrics.read().metrics['menu.renderMs']?.count).toBe(1);
  expect(subject.read().status).toBe('Performance: ready');
  vi.stubGlobal('indexedDB', {
    open: () => {
      throw new Error('Storage denied');
    },
  });
  await subject.start('Phone', 'Wi-Fi');
  expect(subject.read().status).toBe('Incomplete: Storage denied');
  expect(subject.read().canStart).toBe(true);
});

test('a stopped phone recording preserves metadata and checksummed samples through recovery', async () => {
  const saved = storage();
  const metrics = new ClientPerformanceMetrics(true);
  const subject = collector(metrics);
  await subject.start('Pixel 9', 'Wi-Fi, cooled');
  expect(subject.read().phase).toBe('recording');
  expect(() => metrics.read(true)).toThrow('Performance drain owned by phone collector');
  metrics.record('renderMs', 3);
  await vi.advanceTimersByTimeAsync(1000);
  subject.stop();
  expect(subject.read().canDownload).toBe(true);
  expect(() => metrics.read(true)).not.toThrow();
  const original = await artifact(subject);
  expect(original.content.schemaVersion).toBe(2);
  expect(original.content.metadata.device).toBe('Pixel 9');
  expect(original.content.metadata.conditions).toBe('Wi-Fi, cooled');
  expect(original.content.samples[0].metrics['menu.renderMs'].values).toEqual([3]);
  expect(original.content.samples).toHaveLength(2);
  subject.dispose();
  const restored = collector();
  await restored.recover();
  expect(restored.read().status).toBe('Performance: recovered');
  expect(restored.read().device).toBe('Pixel 9');
  expect((await artifact(restored)).content).toEqual(original.content);
  expect(saved.close).toHaveBeenCalled();
});

test('page hiding flushes a sample and page close stops with an explicit interruption reason', async () => {
  storage();
  const subject = collector();
  await subject.start('Phone', 'Wi-Fi');
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
  document.dispatchEvent(new Event('visibilitychange'));
  expect(subject.read().phase).toBe('recording');
  window.dispatchEvent(new Event('pagehide'));
  expect(subject.read().status).toContain('Page closed before explicit Stop');
  const saved = await artifact(subject);
  expect(saved.content.samples).toHaveLength(2);
  expect(vi.getTimerCount()).toBe(0);
});

test('recording stops at thirty minutes and oversized escaped samples stay within the artifact cap', async () => {
  storage();
  const metrics = new ClientPerformanceMetrics(true);
  const subject = collector(metrics);
  await subject.start('Phone', 'Controlled duration');
  // A delayed single drain exercises the same elapsed-time boundary without 1,800 intervals.
  vi.spyOn(performance, 'now').mockReturnValue(30 * 60 * 1000);
  await vi.advanceTimersByTimeAsync(1000);
  expect(subject.read().status).toContain('30 minute collection limit reached');
  expect(vi.getTimerCount()).toBe(0);
  vi.restoreAllMocks();
  await subject.start('Phone', 'Escaping capacity');
  metrics.setGraphicsSettings({ capacity: '\\'.repeat(9 * 1024 * 1024) });
  await vi.advanceTimersByTimeAsync(1000);
  expect(subject.read().status).toContain('32 MiB artifact limit reached');
  const bounded = await artifact(subject);
  expect(bounded.result.blob.size).toBeLessThanOrEqual(32 * 1024 * 1024);
  expect(bounded.content.samples).toHaveLength(0);
});

test('a failed save stops the drain and a later recovered corrupt sample is marked incomplete', async () => {
  const saved = storage();
  const metrics = new ClientPerformanceMetrics(true);
  const subject = collector(metrics);
  saved.failWrites();
  await subject.start('Phone', 'Storage failing');
  await vi.advanceTimersByTimeAsync(0);
  expect(subject.read().status).toContain('Storage write failed');
  expect(() => metrics.read(true)).not.toThrow();
  expect(vi.getTimerCount()).toBe(0);
  const good = storage();
  await subject.start('Phone', 'Recover corruption');
  subject.stop();
  await artifact(subject);
  const id = good.rows.get('latest');
  good.rows.set(`${id}:0`, '{broken');
  const restored = collector();
  await restored.recover();
  expect(restored.read().status).toContain('corrupt sample');
});

test('disposing during a pending storage open closes its late result without claiming or notifying', async () => {
  const close = vi.fn();
  const request = { result: { close }, onsuccess: () => {} };
  vi.stubGlobal('indexedDB', { open: () => request });
  const changed = vi.fn();
  const metrics = new ClientPerformanceMetrics(true);
  const subject = collector(metrics, changed);
  const starting = subject.start('Phone', 'Late open');
  subject.dispose();
  changed.mockClear();
  request.onsuccess();
  await starting;
  expect(close).toHaveBeenCalledExactlyOnceWith();
  expect(changed).not.toHaveBeenCalled();
  expect(() => metrics.read(true)).not.toThrow();
  expect(vi.getTimerCount()).toBe(0);
});

test.each(['resolve', 'reject'])(
  'a checksum that settles by %s after disposal cannot download or notify',
  async (settlement) => {
    storage();
    const changed = vi.fn();
    const subject = collector(new ClientPerformanceMetrics(true), changed);
    await subject.start('Phone', 'Late digest');
    subject.stop();
    const digest = Promise.withResolvers<ArrayBuffer>();
    vi.stubGlobal('crypto', {
      randomUUID: webcrypto.randomUUID.bind(webcrypto),
      subtle: { digest: vi.fn(() => digest.promise) },
    });
    const pending = subject.download();
    await vi.advanceTimersByTimeAsync(0);
    subject.dispose();
    changed.mockClear();
    if (settlement === 'resolve') {
      digest.resolve(new ArrayBuffer(32));
    } else {
      digest.reject(new Error('Late digest failure'));
    }
    expect(await pending).toBeNull();
    expect(changed).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  }
);

test('recovering a saved session never releases another active collector drain', async () => {
  storage();
  const metrics = new ClientPerformanceMetrics(true);
  const recording = collector(metrics);
  await recording.start('Phone', 'Active owner');
  await vi.advanceTimersByTimeAsync(0);
  const recovered = collector(metrics);
  await recovered.recover();
  expect(recovered.read().status).toContain('Recording interrupted');
  expect(() => metrics.read(true)).toThrow('Performance drain owned by phone collector');
  recovered.dispose();
  expect(() => metrics.read(true)).toThrow('Performance drain owned by phone collector');
  recording.stop();
  expect(() => metrics.read(true)).not.toThrow();
});

test('insecure collection keeps every recording command disabled', async () => {
  vi.stubGlobal('crypto', {});
  const subject = collector();
  expect(subject.read().phase).toBe('unavailable');
  expect(subject.read().status).toContain('requires HTTPS');
  await subject.start('Phone', 'No secure APIs');
  await subject.recover();
  expect(await subject.download()).toBeNull();
  expect(subject.read()).toMatchObject({
    canStart: false,
    canStop: false,
    canRecover: false,
    canDownload: false,
  });
  expect(vi.getTimerCount()).toBe(0);
});

test('a report summarizes the stopped measured session across chunks without warmup or draining raw data', async () => {
  storage();
  const metrics = new ClientPerformanceMetrics(true);
  metrics.setPhase('play');
  metrics.setGraphicsSettings({ maxDpr: 'native', effectiveDpr: 1.5, glow: 'off' });
  metrics.observeServerRelease(() => 'server-test');
  metrics.record('frameIntervalMs', 999);
  const subject = collector(metrics);
  expect(subject.readDiagnostics()).toMatchObject({
    complete: false,
    incompleteReasons: ['No collected performance session'],
  });
  await subject.start('KFTUWI', 'Glow off, quiet scene');
  metrics.record('frameIntervalMs', 100);
  metrics.record('frameCpuMs', 4);
  metrics.recordRendererFrame('canvas');
  await vi.advanceTimersByTimeAsync(1000);
  for (let frame = 0; frame < 99; frame++) {
    metrics.record('frameIntervalMs', 16);
    metrics.record('frameCpuMs', 2);
    metrics.recordRendererFrame('canvas');
  }
  await vi.advanceTimersByTimeAsync(1000);
  subject.stop();
  const before = await artifact(subject);
  metrics.record('frameIntervalMs', 500);
  const summary = subject.readDiagnostics();
  expect(summary).toMatchObject({
    complete: true,
    stopped: true,
    recovered: false,
    durationMs: 2000,
    phaseDurationsMs: { play: 2000, menu: 0, respawn: 0, hidden: 0 },
    frameCoverageByPhase: {
      play: {
        completedFrameCount: 100,
        intervalCoverageMs: 1684,
        phaseDurationMs: 2000,
        intervalCoverageRatio: 0.842,
        fullWindowFramesPerSecond: 50,
      },
    },
    provenance: {
      graphics: { maxDpr: 'native', effectiveDpr: 1.5, glow: 'off' },
      rendererBackend: 'canvas',
      serverReleaseId: 'server-test',
    },
    rendererFrames: { canvas: 100, webgl2: 0 },
    metrics: {
      'play.frameIntervalMs': {
        count: 100,
        retainedCount: 100,
        omittedSamples: 0,
        sum: 1684,
        mean: 16.84,
        max: 100,
        p50: 16,
        p95: 16,
        p99: 16,
        over25Ms: 1,
        over33Ms: 1,
        framesPerSecond: 100000 / 1684,
      },
      'play.frameCpuMs': { count: 100, sum: 202, max: 4, p95: 2, p99: 2 },
    },
  });
  expect(new TextEncoder().encode(JSON.stringify(summary)).byteLength).toBeLessThan(32 * 1024);
  const report = parseDebugReportSubmission(
    JSON.parse(
      JSON.stringify({
        version: 1,
        id: '12345678-1234-4123-8123-123456789abc',
        receiptToken: 'a'.repeat(64),
        description: 'Glow off comparison',
        submittedAt: new Date().toISOString(),
        diagnostics: sanitizeDebugDiagnostics({
          state: {
            version: 1,
            capturedAt: new Date().toISOString(),
            sessionId: 'tablet-page',
            metrics: { performance: summary },
          },
          recentLogs: [],
        }),
      })
    )
  );
  expect(report.diagnostics.state['metrics']).toEqual({ performance: summary });
  expect((await artifact(subject)).content).toEqual(before.content);
  expect(metrics.read().metrics['play.frameIntervalMs']?.values).toEqual([500]);
  const recovered = collector();
  await recovered.recover();
  expect(recovered.readDiagnostics()).toMatchObject({ complete: true, recovered: true });
});

test('reports with unfinished, interrupted, or truncated recordings never claim complete percentiles', async () => {
  storage();
  const metrics = new ClientPerformanceMetrics(true);
  metrics.setPhase('play');
  const subject = collector(metrics);
  await subject.start('Phone', 'Interrupted');
  metrics.record('frameIntervalMs', 16);
  await vi.advanceTimersByTimeAsync(1000);
  const unfinished = subject.readDiagnostics();
  expect(unfinished).toMatchObject({
    complete: false,
    incompleteReasons: ['Recording has not been stopped'],
    metrics: { 'play.frameIntervalMs': { count: 1, sum: 16, p95: null, p99: null } },
  });
  window.dispatchEvent(new Event('pagehide'));
  await artifact(subject);
  const recovered = collector();
  await recovered.recover();
  expect(recovered.readDiagnostics()).toMatchObject({
    complete: false,
    recovered: true,
    incompleteReasons: ['Page closed before explicit Stop'],
    metrics: { 'play.frameIntervalMs': { p95: null, p99: null } },
  });
  await subject.start('Phone', 'Raw sample overflow');
  for (let frame = 0; frame < 4100; frame++) {
    metrics.record('frameIntervalMs', 16);
  }
  subject.stop();
  expect(subject.readDiagnostics()).toMatchObject({
    complete: false,
    metrics: {
      'play.frameIntervalMs': {
        count: 4100,
        retainedCount: 4096,
        omittedSamples: 4,
        sum: 65600,
        p95: null,
        p99: null,
      },
    },
  });
});

test('a corrupt recovered summary fails safely while its local artifact remains available', async () => {
  const saved = storage();
  const metrics = new ClientPerformanceMetrics(true);
  metrics.setPhase('play');
  const subject = collector(metrics);
  await subject.start('Phone', 'Corrupt persisted data');
  metrics.record('frameIntervalMs', 16);
  subject.stop();
  await artifact(subject);
  const id = saved.rows.get('latest');
  saved.rows.set(`${id}:0`, JSON.stringify({ metrics: {}, counters: {}, durationMs: 0 }));
  const recovered = collector();
  await recovered.recover();
  expect(recovered.readDiagnostics()).toMatchObject({
    complete: false,
    incompleteReasons: ['Performance summary unavailable; recording remains local'],
  });
  expect(await recovered.download()).not.toBeNull();
});

test.each(['graphics', 'renderer', 'server release'])(
  'changing %s between real recording chunks preserves counts but invalidates percentiles',
  async (changed) => {
    storage();
    const metrics = new ClientPerformanceMetrics(true);
    metrics.setPhase('play');
    metrics.setGraphicsSettings({ maxDpr: 'native', glow: 'full' });
    let serverRelease = 'server-before';
    metrics.observeServerRelease(() => serverRelease);
    const subject = collector(metrics);
    await subject.start('KFTUWI', 'Changing provenance');
    metrics.record('frameIntervalMs', 16);
    metrics.recordRendererFrame('canvas');
    await vi.advanceTimersByTimeAsync(1000);
    if (changed === 'graphics') {
      metrics.setGraphicsSettings({ maxDpr: 'native', glow: 'off' });
    } else if (changed === 'renderer') {
      metrics.setRendererObservation('webgl2', () => ({ backend: 'webgl2', gpuStats: null }));
    } else {
      serverRelease = 'server-after';
    }
    metrics.record('frameIntervalMs', 40);
    metrics.recordRendererFrame(changed === 'renderer' ? 'webgl2' : 'canvas');
    await vi.advanceTimersByTimeAsync(1000);
    subject.stop();
    expect(subject.readDiagnostics()).toMatchObject({
      complete: false,
      incompleteReasons: ['Release, graphics, or renderer changed during recording'],
      metrics: {
        'play.frameIntervalMs': {
          count: 2,
          retainedCount: 2,
          omittedSamples: 0,
          sum: 56,
          max: 40,
          p50: null,
          p95: null,
          p99: null,
        },
      },
    });
  }
);
