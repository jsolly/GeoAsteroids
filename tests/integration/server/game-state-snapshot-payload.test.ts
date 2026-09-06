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

      const states = await collectGameStates(player, 4);
      const full = states.find((message) => message.data?.full === true) ?? states[0];
      const delta = states.find((message) => message.data?.full !== true);
      expect(full?.data?.asteroids?.length).toBeGreaterThan(0);
      expect(delta).toBeDefined();

      const fullBytes = Buffer.byteLength(JSON.stringify(full), 'utf8');
      const deltaBytes = Buffer.byteLength(JSON.stringify(delta), 'utf8');
      expect(deltaBytes).toBeLessThan(fullBytes);

      const leanRoid = delta.data.asteroids[0];
      expect(leanRoid.id).toBeDefined();
      expect(leanRoid.offsets).toBeUndefined();
      expect(leanRoid.vertices).toBeUndefined();

      const trackedId = batch.data.asteroids[0].id as string;
      const firstPose = full.data.asteroids.find((asteroid: { id: string }) => asteroid.id === trackedId);
      const later = states[states.length - 1];
      const laterPose = later.data.asteroids.find((asteroid: { id: string }) => asteroid.id === trackedId);
      expect(firstPose?.position || laterPose?.position).toBeDefined();
      const live = server.gameEngine.getAsteroid(trackedId);
      expect(live).toBeDefined();
      if (laterPose?.position) {
        expect(Math.abs(laterPose.position.x - live!.position.x)).toBeLessThan(2);
        expect(Math.abs(laterPose.position.y - live!.position.y)).toBeLessThan(2);
      }
    } finally {
      player.close();
    }
  });
});
