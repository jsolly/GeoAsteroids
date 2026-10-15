// @vitest-environment node
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it as test } from 'vitest';
import { DebugReportWorker } from '../../../server/debugReports/client';
import { readDebugReportConfiguration } from '../../../server/debugReports/configuration';
import type { DebugReportSubmission } from '../../../shared-types';

const directories: string[] = [];
const workers: DebugReportWorker[] = [];
afterEach(async () => {
  for (const worker of workers.splice(0)) {
    await worker.close();
  }
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('isolates storage failure from the caller and leaves valid submissions retryable after restart', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'georoids-report-worker-'));
  directories.push(directory);
  const config = {
    path: join(directory, 'inbox.sqlite'),
    token: '',
    projectId: 'project-one',
    sectionId: 'section-one',
  };
  const first = new DebugReportWorker(config);
  workers.push(first);
  const report: DebugReportSubmission = {
    version: 1,
    id: randomUUID(),
    receiptToken: randomBytes(32).toString('hex'),
    description: 'The connection dropped.',
    submittedAt: '2026-10-15T12:00:00.000Z',
    diagnostics: {
      state: {
        version: 1,
        capturedAt: '2026-10-15T12:00:00.000Z',
        sessionId: 'owned-worker-session',
        connected: false,
      },
      recentLogs: [],
    },
  };
  await expect(first.enqueue('{malformed', 'address', {})).rejects.toMatchObject({ status: 400 });
  await expect(
    first.enqueue(JSON.stringify(report), 'address', { connectedPlayers: 3 })
  ).resolves.toEqual({ id: report.id, state: 'blocked' });
  await first.close();
  workers.splice(workers.indexOf(first), 1);
  const reopened = new DebugReportWorker(config);
  workers.push(reopened);
  await expect(reopened.enqueue(JSON.stringify(report), 'address', {})).resolves.toEqual({
    id: report.id,
    state: 'blocked',
  });
  await expect(reopened.status(report.id, report.receiptToken)).resolves.toEqual({
    id: report.id,
    state: 'blocked',
  });
  await expect(reopened.status(report.id, 'different-capability')).resolves.toBeNull();
  expect(reopened.diagnostics().blocked).toBe(1);
  const broken = new DebugReportWorker({ ...config, path: directory });
  workers.push(broken);
  await expect(broken.enqueue(JSON.stringify(report), 'address', {})).rejects.toMatchObject({
    status: 503,
  });
  await expect(reopened.status(report.id, report.receiptToken)).resolves.toMatchObject({
    state: 'blocked',
  });
});

test('cannot silently open production world storage or escape its reviewed volume', () => {
  const env = {
    NODE_ENV: 'production',
    RAILWAY_ENVIRONMENT_ID: 'owned-environment',
    RAILWAY_VOLUME_MOUNT_PATH: '/data',
    GEOROIDS_WORLD_PATH: '/data/world.sqlite',
  };
  expect(readDebugReportConfiguration(env, 'production')?.path).toBe('/data/debug-reports.sqlite');
  expect(
    readDebugReportConfiguration(
      { ...env, GEOROIDS_DEBUG_REPORTS_PATH: '/data/world.sqlite' },
      'production'
    )
  ).toBeUndefined();
  expect(
    readDebugReportConfiguration(
      { ...env, GEOROIDS_DEBUG_REPORTS_PATH: '/other/reports.sqlite' },
      'production'
    )
  ).toBeUndefined();
  expect(
    readDebugReportConfiguration(
      { ...env, GEOROIDS_DEBUG_REPORTS_PATH: 'relative.sqlite' },
      'production'
    )
  ).toBeUndefined();
  expect(readDebugReportConfiguration({ NODE_ENV: 'test' }, 'development')).toBeUndefined();
  expect(readDebugReportConfiguration({ VITEST: 'true' }, 'development')).toBeUndefined();
  expect(
    readDebugReportConfiguration(
      { VITEST: 'true', GEOROIDS_DEBUG_REPORTS_PATH: '/data/reports.sqlite' },
      'development'
    )
  ).toBeUndefined();
});
