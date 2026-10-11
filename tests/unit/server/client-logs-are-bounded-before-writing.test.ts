/* @vitest-environment node */
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import {
  createLogRecord,
  LOG_LINE_MAX_BYTES,
  stringifyLogRecord,
} from '../../../shared/logRecords';
import type { DiagnosticLogRecord } from '../../../shared-types';

const state = vi.hoisted(() => ({
  writes: [] as string[],
  stalled: false,
  statSize: 0,
  rm: vi.fn(async () => undefined),
  rename: vi.fn(async () => undefined),
  appendError: null as Error | null,
}));
const serverLogging = vi.hoisted(() => ({
  error: vi.fn(),
  emitExternal: vi.fn(),
}));
const CLIENT_LOG_ROTATED_PATTERN = /client\.log\.1$/u;
const CLIENT_LOG_PATTERN = /client\.log$/u;

vi.mock('../../../setup/serverLogger', () => ({
  logger: { error: serverLogging.error },
  emitExternalLogRecord: serverLogging.emitExternal,
}));

vi.mock('node:fs', () => ({
  promises: {
    mkdir: vi.fn(async () => undefined),
    stat: vi.fn(async () => ({ size: state.statSize })),
    appendFile: vi.fn(async (_path: string, value: string) => {
      state.writes.push(value);
      if (state.appendError) {
        throw state.appendError;
      }
      if (state.stalled) {
        await new Promise(() => undefined);
      }
    }),
    rm: state.rm,
    rename: state.rename,
  },
}));

beforeEach(() => {
  vi.resetModules();
  state.writes = [];
  state.stalled = false;
  state.statSize = 0;
  state.rm.mockClear();
  state.rename.mockClear();
  state.appendError = null;
  serverLogging.error.mockClear();
  serverLogging.emitExternal.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

function payload(message: string, level: DiagnosticLogRecord['level'] = 'info') {
  return {
    level,
    sessionId: 'page-session',
    line: stringifyLogRecord(
      createLogRecord({
        timestamp: '2026-01-01T00:00:00.000Z',
        source: 'client',
        level,
        releaseId: 'client-release',
        message,
      })
    ),
  };
}

test('forwarded client records redact secrets and use the envelope session for correlation', async () => {
  const { ClientLogger } = await import('../../../server/services/ClientLogger');
  const line = JSON.stringify({
    version: 1,
    timestamp: '2026-01-01T00:00:00.000Z',
    source: 'client',
    level: 'warn',
    releaseId: 'client-release',
    sessionId: 'record-session',
    message: 'first\r\nforged\u001b[31m token=private-token',
    context: { authorization: 'private-credential', pageUrl: 'https://example.test/play?secret' },
  });
  expect(
    ClientLogger.logClientMessage(
      {
        level: 'warn',
        line,
        sessionId: 'session\nforged',
        userAgent: 'browser\nforged',
        pageUrl: 'https://example.test/status?token=private-token#fragment',
      },
      {}
    )
  ).toBe('accepted');
  expect(await ClientLogger.flushPending()).toBe(true);
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0]).not.toContain('\r');
  expect(state.writes[0]?.match(/\n/gu)).toHaveLength(1);
  expect(JSON.parse(state.writes[0] ?? '')).toMatchObject({
    source: 'client',
    level: 'warn',
    message: 'first  forged [31m token=[redacted]',
    sessionId: 'session forged',
    context: {
      authorization: '[redacted]',
      userAgent: 'browser forged',
      pageUrl: 'https://example.test/status',
    },
    receivedAt: expect.any(String),
    receiverReleaseId: expect.any(String),
  });
  expect(state.writes[0]).not.toContain('private-token');
  expect(state.writes[0]).not.toContain('private-credential');
  expect(state.writes[0]).not.toContain('record-session');
});

test('client ingress rejects plaintext, malformed records, level mismatches and oversized lines', async () => {
  const { ClientLogger } = await import('../../../server/services/ClientLogger');
  const valid = payload('bounded record');
  for (const invalid of [
    { level: 'info', message: 'plaintext' },
    { ...valid, message: 'extra plaintext alternative' },
    { ...valid, level: 'INFO' },
    { ...valid, level: 'TRACE' },
    { ...valid, level: 'warn' },
    { ...valid, arbitrary: true },
    { ...valid, sessionId: 'x'.repeat(129) },
    { ...valid, userAgent: 'x'.repeat(513) },
    { ...valid, pageUrl: 'x'.repeat(2049) },
    { ...valid, line: 'plaintext' },
    { ...valid, line: '{broken' },
    { ...valid, line: valid.line.replace('client', 'server') },
    { ...valid, line: valid.line.replace('2026-01-01T00:00:00.000Z', 'not a date') },
    { ...valid, line: 'x'.repeat(LOG_LINE_MAX_BYTES + 1) },
    { ...valid, line: JSON.stringify({ ...JSON.parse(valid.line), message: '😀'.repeat(2100) }) },
  ]) {
    expect(ClientLogger.logClientMessage(invalid, {})).toBe('invalid');
  }
  expect(state.writes).toHaveLength(0);
  expect(ClientLogger.getDiagnostics()).toMatchObject({ accepted: 0, invalid: 15 });
});

test('a rejected client-log append makes the completed flush fail', async () => {
  state.appendError = new Error('client disk unavailable');
  const { ClientLogger } = await import('../../../server/services/ClientLogger');
  expect(ClientLogger.logClientMessage(payload('persist me', 'error'), {})).toBe('accepted');
  await expect(ClientLogger.flushPending()).resolves.toBe(false);
  expect(serverLogging.error).toHaveBeenCalledExactlyOnceWith(
    'LOGGING',
    'Failed to write forwarded client log',
    { error: state.appendError }
  );
  expect(ClientLogger.getDiagnostics()).toMatchObject({
    writeErrors: 1,
    droppedRecords: 1,
    lastWriteErrorAt: expect.any(String),
  });
});

test('a flush deadline records an actionable failure before returning false', async () => {
  vi.useFakeTimers();
  state.stalled = true;
  const { ClientLogger } = await import('../../../server/services/ClientLogger');
  expect(ClientLogger.logClientMessage(payload('stalled write', 'error'), {})).toBe('accepted');

  const flushing = ClientLogger.flushPending(50);
  await vi.advanceTimersByTimeAsync(49);
  expect(ClientLogger.getDiagnostics().writeErrors).toBe(0);
  await vi.advanceTimersByTimeAsync(1);
  await expect(flushing).resolves.toBe(false);
  expect(ClientLogger.getDiagnostics()).toMatchObject({
    writeErrors: 1,
    droppedRecords: 0,
    lastWriteErrorAt: expect.any(String),
  });
  expect(serverLogging.error).toHaveBeenCalledWith(
    'LOGGING',
    'Failed to write forwarded client log',
    {
      error: expect.objectContaining({
        message: 'Forwarded client log flush timed out after 50 ms',
      }),
    }
  );
});

test('the client log rotates before a write would exceed its disk bound', async () => {
  state.statSize = 10 * 1024 * 1024;
  const { ClientLogger } = await import('../../../server/services/ClientLogger');

  expect(ClientLogger.logClientMessage(payload('after rotation'), {})).toBe('accepted');
  expect(await ClientLogger.flushPending()).toBe(true);
  expect(state.rm).toHaveBeenCalledWith(expect.stringMatching(CLIENT_LOG_ROTATED_PATTERN), {
    force: true,
  });
  expect(state.rename).toHaveBeenCalledWith(
    expect.stringMatching(CLIENT_LOG_PATTERN),
    expect.stringMatching(CLIENT_LOG_ROTATED_PATTERN)
  );
  expect(state.writes).toHaveLength(1);
});

test('accepted client loss telemetry contributes only its bounded delta to diagnostics', async () => {
  const { ClientLogger } = await import('../../../server/services/ClientLogger');
  const line = JSON.stringify({
    version: 1,
    timestamp: new Date().toISOString(),
    source: 'client',
    level: 'warn',
    releaseId: 'client-release',
    category: 'STATE',
    message: 'Client log records dropped before delivery',
    context: { droppedRecords: 9, droppedSinceLastReport: 4 },
  });

  expect(
    ClientLogger.logClientMessage({ level: 'warn', line, sessionId: 'page-session' }, {})
  ).toBe('accepted');
  expect(ClientLogger.getDiagnostics().clientReportedDroppedRecords).toBe(4);

  const forged = line.replace('"droppedSinceLastReport":4', '"droppedSinceLastReport":1000001');
  expect(
    ClientLogger.logClientMessage({ level: 'warn', line: forged, sessionId: 'page-session' }, {})
  ).toBe('accepted');
  expect(ClientLogger.getDiagnostics().clientReportedDroppedRecords).toBe(4);
});

test('valid records retain per-source message and byte quotas with a fresh minute window', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  const { ClientLogger } = await import('../../../server/services/ClientLogger');
  const source = {};
  const small = payload('small record');
  for (let index = 0; index < 120; index++) {
    expect(ClientLogger.logClientMessage(small, source)).toBe('accepted');
  }
  expect(ClientLogger.logClientMessage(small, source)).toBe('rate-limited');
  expect(ClientLogger.logClientMessage(small, {})).toBe('accepted');
  vi.setSystemTime(new Date('2026-01-01T00:01:00.000Z'));
  expect(ClientLogger.logClientMessage(small, source)).toBe('accepted');

  const byteSource = {};
  const large = {
    ...small,
    line: JSON.stringify({ ...JSON.parse(small.line), context: { padding: 'x'.repeat(7000) } }),
  };
  const allowance = Math.floor((256 * 1024) / Buffer.byteLength(JSON.stringify(large), 'utf8'));
  expect(allowance).toBeLessThan(120);
  for (let index = 0; index < allowance; index++) {
    expect(ClientLogger.logClientMessage(large, byteSource)).toBe('accepted');
  }
  expect(ClientLogger.logClientMessage(large, byteSource)).toBe('rate-limited');
  expect(ClientLogger.getDiagnostics().rateLimited).toBe(2);
  expect(await ClientLogger.flushPending()).toBe(true);
});
