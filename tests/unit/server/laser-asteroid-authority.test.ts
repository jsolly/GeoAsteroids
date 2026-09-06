/* @vitest-environment node */
import { afterEach, describe, expect, test } from 'vitest';
import WebSocket from 'ws';
import { createServerInstance } from '../../../server/createServer';
import { GameEngine } from '../../../server/core/GameEngine';
import type { AsteroidData } from '../../../shared-types';

function largeAsteroid(id: string, position = { x: 400, y: 300 }): AsteroidData {
  return {
    id,
    position,
    velocity: { x: 0, y: 0 },
    size: 50,
    jaggedness: 0.5,
    rotation: 0,
    angularVelocity: 0,
    health: 50,
    maxHealth: 50,
    vertices: 8,
    offsets: [1, 1, 1, 1, 1, 1, 1, 1],
  };
}

describe('Server laser↔asteroid authority', () => {
  test('breaks an asteroid once and ignores a second apply of the same hit', () => {
    const engine = new GameEngine();
    engine.addPlayer('p1', 'One', {} as never, { x: 0, y: 0 });
    engine.addAsteroid(largeAsteroid('roid-once'));

    const first = engine.applyLaserAsteroidHit('roid-once', 'p1');
    const second = engine.applyLaserAsteroidHit('roid-once', 'p1');

    expect(first.applied).toBe(true);
    expect(first.points).toBe(20);
    expect(first.newAsteroids).toHaveLength(2);
    expect(second.applied).toBe(false);
    expect(second.newAsteroids).toHaveLength(0);
    expect(engine.getPlayer('p1')?.score).toBe(20);
    expect(engine.getAsteroid('roid-once')).toBeUndefined();
    expect(engine.getAsteroidCount()).toBe(2);
  });

  test('rejects a phantom report whose laser is far from the server asteroid', () => {
    const engine = new GameEngine();
    engine.addPlayer('p1', 'One', {} as never, { x: 0, y: 0 });
    engine.addAsteroid(largeAsteroid('roid-far', { x: 0, y: 0 }));

    const result = engine.applyLaserAsteroidHit('roid-far', 'p1', { x: 2000, y: 2000 });

    expect(result.applied).toBe(false);
    expect(engine.getAsteroid('roid-far')).toBeDefined();
    expect(engine.getPlayer('p1')?.score).toBe(0);
  });

  test('server laser tick breaks an overlapping asteroid once', () => {
    const engine = new GameEngine();
    engine.addPlayer('p1', 'One', {} as never, { x: 0, y: 0 });
    engine.addAsteroid(largeAsteroid('roid-tick', { x: 100, y: 100 }));

    engine.spawnPlayerLaser('p1', { x: 70, y: 100 }, { x: 40, y: 0 });
    const hits = engine.advanceLasersAndResolveHits();

    expect(hits).toHaveLength(1);
    expect(hits[0]?.applied).toBe(true);
    expect(hits[0]?.asteroidId).toBe('roid-tick');
    expect(engine.getAsteroid('roid-tick')).toBeUndefined();

    const again = engine.advanceLasersAndResolveHits();
    expect(again).toHaveLength(0);
    expect(engine.getPlayer('p1')?.score).toBe(20);
  });
});

describe('Two clients cannot double-apply the same asteroidDestroyed', () => {
  let server: ReturnType<typeof createServerInstance> | null = null;
  let port = 0;

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

  test('second asteroidDestroyed for the same id does not award again or re-split', async () => {
    server = createServerInstance({ port: 0, nodeEnv: 'test' });
    port = await server.listening;

    const wsA = new WebSocket(`ws://localhost:${port}/ws`);
    const wsB = new WebSocket(`ws://localhost:${port}/ws`);
    await Promise.all(
      [wsA, wsB].map(
        (ws) =>
          new Promise<void>((resolve, reject) => {
            ws.once('open', () => resolve());
            ws.once('error', (err) => reject(err));
          })
      )
    );

    wsA.send(JSON.stringify({ type: 'join', id: 'player-a', name: 'Nova' }));
    wsB.send(JSON.stringify({ type: 'join', id: 'player-b', name: 'Retro' }));
    wsA.send(JSON.stringify({ type: 'initAsteroids', id: 'player-a', asteroidCount: 1 }));

    const asteroidId = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timed out waiting for asteroid')), 5000);
      wsA.on('message', (raw) => {
        try {
          const msg = JSON.parse(String(raw));
          if (msg?.type === 'asteroidCreateBatch' && msg?.data?.asteroids?.length > 0) {
            clearTimeout(timeout);
            resolve(msg.data.asteroids[0].id);
          }
        } catch {
          // ignore non-JSON
        }
      });
    });

    const received: unknown[] = [];
    const collect = (raw: Buffer) => {
      try {
        received.push(JSON.parse(String(raw)));
      } catch {
        // ignore
      }
    };
    wsA.on('message', collect);
    wsB.on('message', collect);

    const payload = {
      type: 'asteroidDestroyed',
      asteroidId,
      playerId: 'player-a',
      points: 20,
    };
    wsA.send(JSON.stringify(payload));
    wsB.send(JSON.stringify({ ...payload, playerId: 'player-b' }));

    await new Promise((resolve) => setTimeout(resolve, 400));

    const scoreUpdates = received.filter(
      (msg) => (msg as { type?: string }).type === 'scoreUpdate'
    ) as Array<{ data: { playerId: string; score: number } }>;
    const destroyIds = new Set(
      received
        .filter(
          (msg) =>
            (msg as { type?: string }).type === 'asteroidDestroy' &&
            (msg as { data?: { asteroidId?: string } }).data?.asteroidId === asteroidId
        )
        .map((msg) => (msg as { data: { asteroidId: string } }).data.asteroidId)
    );
    const scorers = new Set(scoreUpdates.map((msg) => msg.data.playerId));

    expect(destroyIds.size).toBe(1);
    expect(scorers.size).toBe(1);
    expect(scoreUpdates[0]?.data.score).toBe(20);

    wsA.close();
    wsB.close();
  });
});
