/* @vitest-environment node */
import { describe, expect, test, afterEach } from 'vitest';
import WebSocket from 'ws';
import { createServerInstance } from '../../server/createServer';

describe('Server scoring via asteroidDestroyed', () => {
  let server: ReturnType<typeof createServerInstance> | null = null;
  let port: number = 0;

  afterEach(async () => {
    try {
      if (server) {
        await server.close();
      }
    } finally {
      server = null;
      port = 0;
    }
  });

  test('awards points and broadcasts scoreUpdate', async () => {
    server = createServerInstance({ port: 0, nodeEnv: 'test' });
    port = await server.listening;

    const ws = new WebSocket(`ws://localhost:${port}/ws`);
    await new Promise<void>((resolve, reject) => {
      ws.once('open', () => resolve());
      ws.once('error', (err) => reject(err));
    });

    // Join as player p1
    const playerId = 'p1-test';
    ws.send(JSON.stringify({ type: 'join', id: playerId, name: 'Tester' }));

    // Request server to create one asteroid
    ws.send(JSON.stringify({ type: 'initAsteroids', id: playerId, asteroidCount: 1 }));

    // Capture an asteroid id from either asteroidCreateBatch or asteroidCreate
    const asteroidId: string = await new Promise<string>((resolve, reject) => {
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
        } catch {}
      });
    });

    // Tell server we destroyed that asteroid and should get points
    const points = 20; // matches ROID.POINTS_LARGE
    ws.send(JSON.stringify({ type: 'asteroidDestroyed', asteroidId, playerId, points }));

    // Expect a scoreUpdate reflecting the awarded points
    const updatedScore: number = await new Promise<number>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timed out waiting for scoreUpdate')), 5000);
      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(String(raw));
          if (msg?.type === 'scoreUpdate' && msg?.data?.playerId === playerId) {
            clearTimeout(timeout);
            resolve(msg.data.score);
          }
        } catch {}
      });
    });

    expect(updatedScore).toBe(points);

    ws.close();
  });
});


