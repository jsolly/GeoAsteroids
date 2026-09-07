import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

test('the gameplay socket does not pretty-print every inbound frame', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(join(here, '../../../server/createServer.ts'), 'utf8');
  expect(source).not.toContain('Raw WebSocket data');
  expect(source).not.toContain('Parsed message:');
  expect(source).toContain('shouldLogInboundGameplayMessage');
});
