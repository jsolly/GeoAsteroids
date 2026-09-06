import { expect, test, vi } from 'vitest';
import { logger } from '../../../src/utils/Logger';
import { LogLevel } from '../../../src/utils/logLevel';

test('the shared logger suppresses debug at the default info threshold', () => {
  const previous = logger.getLogLevel();
  logger.setLogLevel(LogLevel.INFO);
  const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
  try {
    logger.debug('TEST', 'per-frame pose must not print at info');
    expect(spy).not.toHaveBeenCalled();
  } finally {
    spy.mockRestore();
    logger.setLogLevel(previous);
  }
});
