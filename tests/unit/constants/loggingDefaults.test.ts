import { expect, test } from 'vitest';
import { LOGGING } from '../../../src/constants';

test('default client log level is not debug so per-frame logs stay off', () => {
  expect(LOGGING.GLOBAL_LOG_LEVEL).not.toBe('debug');
  expect(['error', 'warn', 'info']).toContain(LOGGING.GLOBAL_LOG_LEVEL);
});
