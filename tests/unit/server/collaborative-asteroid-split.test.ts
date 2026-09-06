/* @vitest-environment node */
import { afterEach, describe, expect, test } from 'vitest';
import WebSocket from 'ws';
import { createServerInstance } from '../../../server/createServer';
import { ROID } from '../../../src/constants';

async function openSocket(port: number): Promise<WebSocket> {
  const ws = new WebSocket(`ws://localhost:${port}/ws`);
  await new Promise<void>((resolve, reject) => {
    ws.once('open', () => resolve());
    ws.once('error', (err) => reject(err));
  });
  return ws;
}

function waitForAsteroidId(ws: WebSocket): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timed out waiting for asteroid creation')), 5000);
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw));
        if (msg?.type === 'asteroidCreateBatch' && msg?.data?.asteroids?.length > 0) {
          clearTimeout(timeout);
          resolve(msg.data.asteroids[0].id);
        } else if (msg?.type === 'asteroidCreate' && msg?.data?.asteroid?.id) {
          clearTimeout(timeout);
          resolve(msg.data.asteroid.id);
        }
      } catch {
        // ignore non-JSON frames
      }
    });
  });
}

describe('Scenario: two players hit a big roid within 1s → split', () => {
  let server: ReturnType<typeof createServerInstance> | null = null;

  afterEach(async () => {
    if (server) {
      await server.close();
    }
    server = null;
  });

  test('two players hit big roid within 1s → split', async () => {
    server = createServerInstance({ port: 0, nodeEnv: 'test' });
    const port = await server.listening;

    const playerA = await openSocket(port);
    const playerB = await openSocket(port);

    playerA.send(JSON.stringify({ type: 'join', id: 'player-a', name: 'Alpha' }));
    playerB.send(JSON.stringify({ type: 'join', id: 'player-b', name: 'Bravo' }));

    const asteroidCreated = waitForAsteroidId(playerA);
    playerA.send(JSON.stringify({ type: 'initAsteroids', id: 'player-a', asteroidCount: 1 }));
    const asteroidId = await asteroidCreated;

    const splitMessages: unknown[] = [];
    const onSplit = (raw: Buffer) => {
      try {
        splitMessages.push(JSON.parse(String(raw)));
      } catch {
        // ignore
      }
    };
    playerA.on('message', onSplit);

    playerA.send(
      JSON.stringify({
        type: 'asteroidDestroyed',
        asteroidId,
        playerId: 'player-a',
        points: ROID.POINTS_LARGE,
        cause: 'laser',
      })
    );
    playerB.send(
      JSON.stringify({
        type: 'asteroidDestroyed',
        asteroidId,
        playerId: 'player-b',
        points: ROID.POINTS_LARGE,
        cause: 'laser',
      })
    );

    await expect
      .poll(() => {
        const destroy = splitMessages.find(
          (msg: any) => msg?.type === 'asteroidDestroy' && msg?.data?.asteroidId === asteroidId
        ) as { data?: { collabSplit?: boolean } } | undefined;
        const create = splitMessages.find(
          (msg: any) => msg?.type === 'asteroidCreateBatch' && msg?.data?.asteroids?.length === 2
        );
        return Boolean(destroy?.data?.collabSplit && create);
      }, { timeout: 3000, interval: 25 })
      .toBe(true);

    playerA.close();
    playerB.close();
  });

  test('one player hitting a big roid twice destroys it without splitting', async () => {
    server = createServerInstance({ port: 0, nodeEnv: 'test' });
    const port = await server.listening;

    const playerA = await openSocket(port);
    playerA.send(JSON.stringify({ type: 'join', id: 'solo-player', name: 'Solo' }));

    const asteroidCreated = waitForAsteroidId(playerA);
    playerA.send(JSON.stringify({ type: 'initAsteroids', id: 'solo-player', asteroidCount: 1 }));
    const asteroidId = await asteroidCreated;

    const messages: any[] = [];
    playerA.on('message', (raw) => {
      try {
        messages.push(JSON.parse(String(raw)));
      } catch {
        // ignore
      }
    });

    const hit = { type: 'asteroidDestroyed', asteroidId, playerId: 'solo-player', points: ROID.POINTS_LARGE };
    playerA.send(JSON.stringify(hit));
    playerA.send(JSON.stringify(hit));

    await expect
      .poll(() => {
        const destroy = messages.find(
          (msg) => msg?.type === 'asteroidDestroy' && msg?.data?.asteroidId === asteroidId
        );
        const splitBatch = messages.find(
          (msg) => msg?.type === 'asteroidCreateBatch' && msg?.data?.asteroids?.length === 2
        );
        return destroy && destroy.data.collabSplit === false && !splitBatch;
      }, { timeout: 3000, interval: 25 })
      .toBeTruthy();

    playerA.close();
  });
});
