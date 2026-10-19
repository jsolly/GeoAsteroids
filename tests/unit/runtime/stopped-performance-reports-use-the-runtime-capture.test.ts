import { webcrypto } from 'node:crypto';
import { afterEach, expect, test, vi } from 'vitest';
import { parseDebugReportSubmission } from '../../../shared/debugReports';
import { clientPerformance } from '../../../src/diagnostics/performanceMetrics';
import { storeResumeCredential } from '../../../src/network/services/resumeCredential';
import { createGameRuntime, type GameRuntime } from '../../../src/runtime/gameRuntime';
import type { GamePresentation } from '../../../src/runtime/uiTypes';
import { installPhoneRecordingStorage } from '../../support/phoneRecordingStorage';

// Set the real feature flag before the metrics singleton and runtime are imported.
vi.hoisted(() => window.history.replaceState(null, '', '/debug?performance=collect'));

// Logging transport is external to the runtime and recorder under test.
vi.mock('../../../src/utils/logForwarder', () => ({
  startClientLogForwarder: vi.fn(),
  stopClientLogForwarder: vi.fn(),
  forwardLogToServer: vi.fn(),
}));

let runtime: GameRuntime | undefined;
const scope = new AbortController();

afterEach(() => {
  runtime?.dispose();
  scope.abort();
  expect(vi.getTimerCount()).toBe(0);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

test('stopping the runtime recorder attaches a private, parseable performance summary to Send report', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('crypto', webcrypto);
  localStorage.setItem('soundOn', 'false');
  localStorage.setItem('musicOn', 'false');
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn(() => 1)
  );
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    }
  );
  installPhoneRecordingStorage();
  document.body.innerHTML =
    '<main id="gameWrapper"><div id="gameArea"><canvas id="gameCanvas"></canvas><canvas id="spawn-fly-in"></canvas></div><canvas id="title-terrain"></canvas></main>';
  const canvas = (id: string): HTMLCanvasElement => {
    const element = document.querySelector(`#${id}`);
    if (!(element instanceof HTMLCanvasElement)) {
      throw new Error(`Missing runtime canvas ${id}`);
    }
    return element;
  };
  runtime = createGameRuntime(
    {
      canvas: canvas('gameCanvas'),
      titleCanvas: canvas('title-terrain'),
      spawnCanvas: canvas('spawn-fly-in'),
      placeChrome: vi.fn(),
    },
    scope.signal
  );
  const views: GamePresentation[] = [];
  runtime.subscribe((view) => views.push(view));
  expect(views.at(-1)?.phone?.phase).toBe('ready');
  const nameCanary = 'TabletSecretPilot';
  const tokenCanary = 'bc'.repeat(32);
  storeResumeCredential(tokenCanary, nameCanary);
  runtime.commands.startPhoneCollection(`KFTUWI ${nameCanary}`, `Token canary ${tokenCanary}`);
  await vi.advanceTimersByTimeAsync(0);
  expect(views.at(-1)?.phone?.phase).toBe('recording');
  clientPerformance.setPhase('play');
  clientPerformance.record('frameIntervalMs', 16);
  clientPerformance.recordRendererFrame('canvas');
  await vi.advanceTimersByTimeAsync(1000);
  clientPerformance.record('frameIntervalMs', 40);
  clientPerformance.recordRendererFrame('canvas');
  await vi.advanceTimersByTimeAsync(1000);
  runtime.commands.stopPhoneCollection();
  expect(views.at(-1)?.phone?.phase).toBe('stopped');
  const captured = runtime.commands.captureDiagnostics();
  const wire = JSON.stringify({
    version: 1,
    id: '12345678-1234-4123-8123-123456789abc',
    receiptToken: 'd'.repeat(64),
    description: 'Full glow tablet screening',
    submittedAt: new Date().toISOString(),
    diagnostics: captured,
  });
  expect(wire).not.toContain(nameCanary);
  expect(wire).not.toContain(tokenCanary);
  const parsed = parseDebugReportSubmission(JSON.parse(wire));
  expect(parsed.diagnostics.state['metrics']).toMatchObject({
    performance: {
      complete: true,
      stopped: true,
      device: 'KFTUWI *',
      conditions: 'Token canary [redacted]',
      metrics: { 'play.frameIntervalMs': { count: 2, sum: 56, p95: 40, p99: 40 } },
    },
  });
});
