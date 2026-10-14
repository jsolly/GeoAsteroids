// @vitest-environment node
import { expect, test } from 'vitest';
import { closePlayerMotionScenario } from '../../support/playerMotionCleanup';

test('failed clients still settle before the server closes and every failure is reported', async () => {
  const synchronousFailure = new Error('First client threw');
  const asynchronousFailure = new Error('Second client rejected');
  const serverFailure = new Error('Server rejected');
  const pendingClient = Promise.withResolvers<void>();
  const attempts: string[] = [];
  const cleanup = closePlayerMotionScenario({
    clients: [
      {
        close() {
          attempts.push('first client');
          throw synchronousFailure;
        },
      },
      {
        close() {
          attempts.push('second client');
          return Promise.reject(asynchronousFailure);
        },
      },
      {
        async close() {
          attempts.push('third client');
          await pendingClient.promise;
          attempts.push('third client settled');
        },
      },
    ],
    server: {
      close() {
        attempts.push('server');
        return Promise.reject(serverFailure);
      },
    },
  }).catch((error: unknown) => error);

  expect(attempts).toEqual(['first client', 'second client', 'third client']);
  pendingClient.resolve();
  const failure = await cleanup;
  expect(attempts).toEqual([
    'first client',
    'second client',
    'third client',
    'third client settled',
    'server',
  ]);
  expect(failure).toBeInstanceOf(AggregateError);
  if (failure instanceof AggregateError) {
    expect(failure.errors).toEqual([synchronousFailure, asynchronousFailure, serverFailure]);
  }
});

test('a server close that throws synchronously is reported without any clients', async () => {
  const failure = new Error('Server threw');
  await expect(
    closePlayerMotionScenario({
      clients: [],
      server: {
        close() {
          throw failure;
        },
      },
    })
  ).rejects.toMatchObject({ errors: [failure] });
});
