/* @vitest-environment node */
import { mkdtempSync, rmSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { createServerInstance } from '../../../server/createServer';
import type { DebugReportSubmission } from '../../../shared-types';

const servers: ReturnType<typeof createServerInstance>[] = [];
const directories: string[] = [];
afterEach(async () => {
  for (const server of servers.splice(0)) {
    await server.close();
  }
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

const report: DebugReportSubmission = {
  version: 1,
  id: '12345678-1234-4123-8123-123456789abc',
  receiptToken: 'a'.repeat(64),
  description: 'Ship movement stopped while the socket was disconnected.',
  submittedAt: '2026-10-15T12:00:00.000Z',
  diagnostics: {
    state: {
      version: 1,
      capturedAt: '2026-10-15T11:59:00.000Z',
      sessionId: 'disconnected-page',
      connected: false,
    },
    recentLogs: [],
  },
};

async function start(path: string) {
  const server = createServerInstance({
    port: 0,
    nodeEnv: 'test',
    debugReports: {
      path,
      token: '',
      projectId: 'project-one',
      sectionId: 'section-one',
      limits: { minimumFreeBytes: 0 },
    },
  });
  servers.push(server);
  return { server, origin: `http://127.0.0.1:${await server.listening}` };
}

test('a disconnected browser saves through HTTP, then retries after server restart without losing its receipt', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'georoids-report-http-'));
  directories.push(directory);
  const path = join(directory, 'reports.sqlite');
  const first = await start(path);
  const saved = await fetch(`${first.origin}/debug-reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://www.georoids.com' },
    body: JSON.stringify(report),
  });
  expect(saved.status).toBe(202);
  expect(saved.headers.get('Access-Control-Allow-Origin')).toBe('https://www.georoids.com');
  expect(await saved.json()).toEqual({ id: report.id, state: 'blocked' });
  await first.server.close();
  const second = await start(path);
  const duplicate = await fetch(`${second.origin}/debug-reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(report),
  });
  expect(duplicate.status).toBe(202);
  const status = await fetch(`${second.origin}/debug-reports/${report.id}`, {
    headers: { Authorization: `Bearer ${report.receiptToken}` },
  });
  expect(await status.json()).toEqual({ id: report.id, state: 'blocked' });
  const hidden = await fetch(`${second.origin}/debug-reports/${report.id}`, {
    headers: { Authorization: `Bearer ${'b'.repeat(64)}` },
  });
  expect(hidden.status).toBe(404);
  expect(await hidden.text()).not.toContain(report.description);
  const health = await fetch(`${second.origin}/health`);
  expect(health.status).toBe(200);
  expect(await health.json()).toMatchObject({
    debugReports: { blocked: 1 },
    world: { players: 0 },
  });
});

test('invalid origins and malformed reports are refused without making the game unhealthy', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'georoids-report-rejections-'));
  directories.push(directory);
  const { origin } = await start(join(directory, 'reports.sqlite'));
  const forbidden = await fetch(`${origin}/debug-reports`, {
    method: 'POST',
    headers: { Origin: 'https://attacker.example', 'Content-Type': 'application/json' },
    body: JSON.stringify(report),
  });
  expect(forbidden.status).toBe(403);
  expect(forbidden.headers.get('Access-Control-Allow-Origin')).toBeNull();
  const malformed = await fetch(`${origin}/debug-reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{',
  });
  expect(malformed.status).toBe(400);
  const health = await fetch(`${origin}/health`);
  expect(health.status).toBe(200);
  const malformedTargetStatus = await new Promise<number>((resolve, reject) => {
    const req = request(`${origin}/`, { path: '//[/' }, (res) => {
      res.resume();
      res.once('end', () => resolve(res.statusCode ?? 0));
    });
    req.once('error', reject);
    req.end();
  });
  expect(malformedTargetStatus).toBe(400);
  expect((await fetch(`${origin}/health`)).status).toBe(200);
});
