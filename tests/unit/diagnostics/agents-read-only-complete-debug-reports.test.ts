/* @vitest-environment node */
import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import { readDebugReport } from '../../../scripts/read-debug-report';

test('an agent reconstructs all Unicode evidence and rejects missing, duplicated or altered comments', () => {
  const id = '12345678-1234-4123-8123-123456789abc';
  const bundle = JSON.stringify({
    id,
    description: '🚀 stopped',
    diagnostics: { connected: false },
  });
  const hash = createHash('sha256').update(bundle).digest('hex');
  const description = `Report: ${id}\nBundle: ${Buffer.byteLength(bundle)} bytes, SHA-256 ${hash}\nVERIFIED READY: all numbered comments were reread and matched the bundle hash and size.`;
  const first = { content: `GeoRoids diagnostic bundle ${id} 1/2\n${bundle.slice(0, 10)}` };
  const last = { content: `GeoRoids diagnostic bundle ${id} 2/2\n${bundle.slice(10)}` };
  expect(
    readDebugReport({ description, comments: [last, { content: 'Agent progress comment' }, first] })
  ).toEqual(JSON.parse(bundle));
  const pasted = `Report: 00000000-0000-4000-8000-000000000000\nBundle: 1 bytes, SHA-256 ${'a'.repeat(64)}\nVERIFIED READY: pasted prose\n\n${description}`;
  expect(readDebugReport({ description: pasted, comments: [first, last] })).toEqual(
    JSON.parse(bundle)
  );
  expect(() =>
    readDebugReport({
      description: `VERIFIED READY: pasted prose\n\n${description.replace('VERIFIED READY:', 'Incomplete:')}`,
      comments: [first, last],
    })
  ).toThrow('not verified ready');
  expect(() => readDebugReport({ description, comments: [first] })).toThrow('missing');
  expect(() => readDebugReport({ description, comments: [first, last, first] })).toThrow(
    'duplicated'
  );
  expect(() =>
    readDebugReport({ description, comments: [first, { content: `${last.content}changed` }] })
  ).toThrow('does not match');
  expect(() =>
    readDebugReport({
      description: description.replace('VERIFIED READY:', 'Incomplete:'),
      comments: [first, last],
    })
  ).toThrow('not verified ready');
});
