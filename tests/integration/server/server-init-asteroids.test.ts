import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import WebSocket from 'ws';
import { createServerInstance } from '../../../server/createServer';

function openGameSocket(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

function waitForMessage(ws: WebSocket, type: string, timeoutMs = 5000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${type}`)), timeoutMs);

    const onMessage = (raw: WebSocket.RawData) => {
      const message = JSON.parse(String(raw));
      if (message.type === type) {
        clearTimeout(timer);
        ws.off('message', onMessage);
        resolve(message);
      }
    };

    ws.on('message', onMessage);
  });
}

describe('Server initAsteroids sync', () => {
  let server: Awaited<ReturnType<typeof createServerInstance>>;
  let wsUrl: string;

  beforeAll(async () => {
    server = createServerInstance({ port: 0, nodeEnv: 'test' });
    const port = await server.listening;
    wsUrl = `ws://127.0.0.1:${port}/ws`;
  });

  afterAll(async () => {
    await server.close();
  });

  it('sends existing asteroid batches to the second player with the broadcast envelope', async () => {
    const playerOne = await openGameSocket(wsUrl);
    const playerTwo = await openGameSocket(wsUrl);

    try {
      playerOne.send(
        JSON.stringify({
          type: 'join',
          id: 'player-one',
          data: { name: 'PlayerOne', position: { x: 0, y: 0 } },
          timestamp: Date.now(),
        })
      );
      await waitForMessage(playerOne, 'joined');

      playerOne.send(
        JSON.stringify({
          type: 'initAsteroids',
          id: 'player-one',
          data: { asteroidCount: 10 },
          timestamp: Date.now(),
        })
      );
      const firstBatch = await waitForMessage(playerOne, 'asteroidCreateBatch');
      expect(firstBatch.data?.asteroids?.length).toBeGreaterThan(0);

      playerTwo.send(
        JSON.stringify({
          type: 'join',
          id: 'player-two',
          data: { name: 'PlayerTwo', position: { x: 100, y: 100 } },
          timestamp: Date.now(),
        })
      );
      await waitForMessage(playerTwo, 'joined');

      playerTwo.send(
        JSON.stringify({
          type: 'initAsteroids',
          id: 'player-two',
          data: { asteroidCount: 10 },
          timestamp: Date.now(),
        })
      );
      const secondBatch = await waitForMessage(playerTwo, 'asteroidCreateBatch');
      expect(secondBatch.data?.asteroids?.length).toBe(firstBatch.data.asteroids.length);
      expect(secondBatch.data?.asteroids?.[0]?.id).toBe(firstBatch.data.asteroids[0].id);
    } finally {
      playerOne.close();
      playerTwo.close();
    }
  });
});
