import { expect, test } from 'vitest';
import {
  formatDebugDiagnostics,
  parseDebugReportSubmission,
  sanitizeDebugDiagnostics,
} from '../../../shared/debugReports';
import type { DebugReportSubmission } from '../../../shared-types';

const report: DebugReportSubmission = {
  version: 1,
  id: '12345678-1234-4123-8123-123456789abc',
  receiptToken: 'c'.repeat(64),
  submittedAt: '2026-10-15T12:00:00.000Z',
  description: 'My ship stopped. Please investigate.',
  diagnostics: {
    state: {
      version: 1,
      capturedAt: '2026-10-15T11:59:00.000Z',
      sessionId: 'page-one',
      input: { pointerHeading: 42, liveTouches: 2 },
      audio: {
        error: {
          cause:
            'Alice disconnected from https://user:password@example.com/ws?resumeToken=secret#private',
        },
      },
    },
    recentLogs: [
      JSON.stringify({
        version: 1,
        source: 'client',
        level: 'error',
        timestamp: '2026-10-15T11:59:00.000Z',
        releaseId: 'a'.repeat(40),
        message: `Alice Bearer password-123 ${'b'.repeat(64)}`,
        context: {
          nested: { resumeToken: 'private', stack: 'https://example.com/error?secret=abc#private' },
        },
      }),
    ],
  },
};

test('diagnostic text redaction removes embedded secrets while preserving a frozen input snapshot', () => {
  const snapshot = sanitizeDebugDiagnostics(report.diagnostics, ['Alice']);
  const text = formatDebugDiagnostics(snapshot);
  for (const secret of [
    'Alice',
    'password-123',
    'user:password',
    '?resumeToken',
    '?secret',
    '#private',
    'b'.repeat(64),
  ]) {
    expect(text).not.toContain(secret);
  }
  expect(text).toContain('https://example.com/ws');
  expect(text).toContain('"pointerHeading": 42');
  expect(text).toContain('"liveTouches": 2');
  expect(report.diagnostics.recentLogs[0]).toContain('Alice');
  const input = report.diagnostics.state['input'];
  if (input !== null && typeof input === 'object' && !Array.isArray(input)) {
    input['liveTouches'] = 0;
  }
  expect(formatDebugDiagnostics(snapshot)).toContain('"liveTouches": 2');
});

test('report boundary rejects unsupported state dumps and invalid log records without clipping evidence', () => {
  expect(parseDebugReportSubmission(report).description).toBe(report.description);
  expect(() =>
    parseDebugReportSubmission({
      ...report,
      diagnostics: { ...report.diagnostics, state: { ...report.diagnostics.state, rawWorld: {} } },
    })
  ).toThrow('Unsupported diagnostic field');
  expect(() =>
    parseDebugReportSubmission({
      ...report,
      diagnostics: { ...report.diagnostics, recentLogs: ['plaintext'] },
    })
  ).toThrow('Invalid client diagnostic record');
  expect(() => parseDebugReportSubmission({ ...report, description: ' ' })).toThrow(
    'Invalid debug report'
  );
  expect(() => parseDebugReportSubmission({ ...report, description: 'x'.repeat(4001) })).toThrow(
    'Invalid debug report'
  );
});

test.each(['client', 'e', '2026', 'http', 'Bearer', 'token', 'password'])(
  'pilot name %s cannot corrupt structural diagnostic fields',
  (nickname) => {
    const snapshot = sanitizeDebugDiagnostics(report.diagnostics, [nickname]);
    const parsed = parseDebugReportSubmission({ ...report, diagnostics: snapshot });
    expect(parsed.diagnostics.state['capturedAt']).toBe('2026-10-15T11:59:00.000Z');
    const line: unknown = JSON.parse(parsed.diagnostics.recentLogs[0] ?? '');
    expect(line).toMatchObject({
      source: 'client',
      level: 'error',
      timestamp: '2026-10-15T11:59:00.000Z',
    });
    expect(JSON.stringify(snapshot)).not.toContain('user:password');
    expect(JSON.stringify(snapshot)).not.toContain('password-123');
  }
);

test('redacting a repeated short pilot name does not inflate a near-limit log', () => {
  const log = {
    version: 1,
    source: 'client',
    level: 'error',
    timestamp: '2026-10-15T11:59:00.000Z',
    message: 'e '.repeat(3500),
  };
  const snapshot = sanitizeDebugDiagnostics(
    { state: report.diagnostics.state, recentLogs: [JSON.stringify(log)] },
    ['e']
  );
  expect(() => parseDebugReportSubmission({ ...report, diagnostics: snapshot })).not.toThrow();
  expect(new TextEncoder().encode(snapshot.recentLogs[0]).length).toBeLessThanOrEqual(
    new TextEncoder().encode(JSON.stringify(log)).length
  );
});
