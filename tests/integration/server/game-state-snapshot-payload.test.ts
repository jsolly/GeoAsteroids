import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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

function collectGameStates(ws: WebSocket, count: number, timeoutMs = 4000): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const found: any[] = [];
    const timer = setTimeout(() => {
      ws.off('message', onMessage);
      reject(new Error(`Timed out collecting ${count} gameState messages (got ${found.length})`));
    }, timeoutMs);

    const onMessage = (raw: WebSocket.RawData) => {
      const message = JSON.parse(String(raw));
      if (message.type === 'gameState') {
        found.push(message);
        if (found.length >= count) {
          clearTimeout(timer);
          ws.off('message', onMessage);
          resolve(found);
        }
      }
    };

    ws.on('message', onMessage);
  });
}

describe('lean gameState snapshots', () => {
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

  it('sends a full keyframe then lean deltas that still move the shared field', async () => {
    const player = await openGameSocket(wsUrl);

    try {
      player.send(
        JSON.stringify({
          type: 'join',
          id: 'lean-one',
          data: { name: 'LeanOne', position: { x: 0, y: 0 } },
          timestamp: Date.now(),
        })
      );
      const joined = await waitForMessage(player, 'joined');

      player.send(
        JSON.stringify({
          type: 'initAsteroids',
          id: joined.data?.id ?? 'lean-one',
          data: { asteroidCount: 20 },
          timestamp: Date.now(),
        })
      );
      const batch = await waitForMessage(player, 'asteroidCreateBatch');
      expect(batch.data?.asteroids?.length).toBe(20);
      expect(batch.data.asteroids[0].offsets.length).toBeGreaterThan(0);

      const states = await collectGameStates(player, 6);
      const withShape = states.find((message) => message.data?.asteroids?.[0]?.offsets);
      const lean = states.find((message) => {
        const asteroid = message.data?.asteroids?.[0];
        return asteroid?.id && asteroid.offsets === undefined && asteroid.position;
      });
      expect(lean).toBeDefined();
      expect(lean.data.asteroids).toHaveLength(20);

      const leanBytes = Buffer.byteLength(JSON.stringify(lean), 'utf8');
      if (withShape) {
        expect(leanBytes).toBeLessThan(Buffer.byteLength(JSON.stringify(withShape), 'utf8'));
      }
      expect(leanBytes).toBeLessThan(Buffer.byteLength(JSON.stringify(batch), 'utf8') * 2);

      const leanRoid = lean.data.asteroids[0];
      expect(leanRoid.id).toBeDefined();
      expect(leanRoid.vertices).toBeUndefined();
      expect(leanRoid.jaggedness).toBeUndefined();

      const trackedId = batch.data.asteroids[0].id as string;
      const leans = states.filter((message) => {
        const asteroid = message.data?.asteroids?.find((row: { id: string }) => row.id === trackedId);
        return asteroid?.position && asteroid.offsets === undefined;
      });
      const latestLean = leans[leans.length - 1];
      expect(latestLean).toBeDefined();
      const laterPose = latestLean.data.asteroids.find(
        (asteroid: { id: string }) => asteroid.id === trackedId
      );
      const spawnPose = batch.data.asteroids.find((asteroid: { id: string }) => asteroid.id === trackedId);
      const live = server.gameEngine.getAsteroid(trackedId);
      expect(live).toBeDefined();
      expect(laterPose?.position).toBeDefined();
      expect(
        laterPose.position.x !== spawnPose.position.x || laterPose.position.y !== spawnPose.position.y
      ).toBe(true);
      expect(Math.abs(laterPose.position.x - live!.position.x)).toBeLessThan(12);
      expect(Math.abs(laterPose.position.y - live!.position.y)).toBeLessThan(12);
    } finally {
      player.close();
    }
  });
});
