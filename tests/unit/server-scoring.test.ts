/* @vitest-environment node */
import { describe, expect, test, afterEach } from 'vitest';
import WebSocket from 'ws';
import { createServerInstance } from '../../server/createServer';
import { ROID } from '../../src/constants';

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

  test('RoidKillsPlayer scenario - server-side scoring matches client expectations', async () => {
    server = createServerInstance({ port: 0, nodeEnv: 'test' });
    port = await server.listening;

    const ws = new WebSocket(`ws://localhost:${port}/ws`);
    await new Promise<void>((resolve, reject) => {
      ws.once('open', () => resolve());
      ws.once('error', (err) => reject(err));
    });

    // Join as player (mimicking the client test setup)
    const playerId = 'test-player-server';
    ws.send(JSON.stringify({ type: 'join', id: playerId, name: 'TestPlayer' }));

    // Request server to create one asteroid (mimicking large asteroid from client test)
    ws.send(JSON.stringify({ type: 'initAsteroids', id: playerId, asteroidCount: 1 }));

    // Wait for asteroid creation and capture the asteroid ID
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

    // Verify we got an asteroid ID
    expect(asteroidId).toBeDefined();
    expect(typeof asteroidId).toBe('string');
    expect(asteroidId).toMatch(/^server-asteroid-/);

    // Collect all messages received after sending asteroidDestroyed
    const receivedMessages: any[] = [];
    const messageHandler = (raw: Buffer) => {
      try {
        const msg = JSON.parse(String(raw));
        receivedMessages.push(msg);
      } catch {}
    };
    ws.on('message', messageHandler);

    // Simulate the client-side collision: send asteroidDestroyed with large asteroid points
    const expectedPoints = ROID.POINTS_LARGE; // 20 points for large asteroid
    ws.send(JSON.stringify({
      type: 'asteroidDestroyed',
      asteroidId,
      playerId,
      points: expectedPoints
    }));

    // Wait for messages to be processed
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Remove the message handler
    ws.off('message', messageHandler);

    // Find the scoreUpdate message
    const scoreUpdate = receivedMessages.find(msg =>
      msg?.type === 'scoreUpdate' && msg?.data?.playerId === playerId
    );

    // Verify the scoreUpdate message structure and values
    expect(scoreUpdate).toBeDefined();
    expect(scoreUpdate).toHaveProperty('type', 'scoreUpdate');
    expect(scoreUpdate).toHaveProperty('data');
    expect(scoreUpdate.data).toHaveProperty('playerId', playerId);
    expect(scoreUpdate.data).toHaveProperty('score', expectedPoints);
    expect(scoreUpdate).toHaveProperty('timestamp');
    expect(typeof scoreUpdate.timestamp).toBe('number');

    // Find the asteroidDestroy message
    const asteroidDestruction = receivedMessages.find(msg =>
      msg?.type === 'asteroidDestroy' && msg?.data?.asteroidId === asteroidId
    );

    expect(asteroidDestruction).toBeDefined();
    expect(asteroidDestruction).toHaveProperty('type', 'asteroidDestroy');
    expect(asteroidDestruction.data).toHaveProperty('asteroidId', asteroidId);

    // Verify that new asteroids were created from splitting
    const asteroidCreation = receivedMessages.find(msg =>
      msg?.type === 'asteroidCreateBatch' && msg?.data?.asteroids?.length === 2
    );

    expect(asteroidCreation).toBeDefined();
    expect(asteroidCreation.data.asteroids).toHaveLength(2);

    ws.close();
  });
});


