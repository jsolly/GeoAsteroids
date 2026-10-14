import { afterEach, expect, test, vi } from 'vitest';

const forwarding = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock('../../../src/utils/logForwarder', () => ({
  startClientLogForwarder: vi.fn(),
  forwardLogToServer: forwarding.send,
}));

vi.mock('../../../src/utils/logForwardPolicy', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/utils/logForwardPolicy')>();
  return {
    shouldForwardClientLog: (
      level: 'debug' | 'info' | 'warn' | 'error',
      category: string,
      _production: boolean,
      message = ''
    ) => actual.shouldForwardClientLog(level, category, true, message),
  };
});

vi.mock('../../../src/constants', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/constants')>();
  return {
    ...actual,
    LOGGING: { ...actual.LOGGING, WRITE_TO_CONSOLE: false, FORWARD_TO_SERVER: true },
  };
});

import { logger } from '../../../src/utils/Logger';

logger.attachRuntime();
afterEach(() => vi.unstubAllEnvs());

test('the production logger forwards one critical state message and keeps reconnect chatter local', async () => {
  logger.info('STATE', 'reconnect_scheduled');
  await Promise.resolve();
  expect(forwarding.send).not.toHaveBeenCalled();
  logger.info('STATE', 'player_died');
  await vi.waitFor(() => expect(forwarding.send).toHaveBeenCalledOnce());
  expect(JSON.parse(String(forwarding.send.mock.calls[0]?.[0]))).toMatchObject({
    category: 'STATE',
    message: 'player_died',
  });
});
