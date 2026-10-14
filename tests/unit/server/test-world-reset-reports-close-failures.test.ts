/* @vitest-environment node */
import { afterEach, describe, expect, test, vi } from 'vitest';
import { WebSocket } from 'ws';
import { GameEngine } from '../../../server/core/GameEngine';

describe('test-world reset lifecycle failures', () => {
  let gameEngine: GameEngine | undefined;

  afterEach(() => {
    gameEngine?.stopGameLoop();
    gameEngine = undefined;
    vi.restoreAllMocks();
  });

  test('reports a live socket close failure before clearing the world', () => {
    const close = vi.fn(() => {
      throw new Error('socket close failed');
    });
    const socket = {
      CLOSED: WebSocket.CLOSED,
      close,
      readyState: WebSocket.OPEN,
    } as unknown as WebSocket;
    const engine = new GameEngine(921);
    gameEngine = engine;
    engine.addPlayer('pilot', 'Pilot', socket, { x: 0, y: 0 });

    let failure: unknown;
    try {
      engine.resetForTesting();
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(AggregateError);
    if (!(failure instanceof AggregateError)) {
      return;
    }
    expect(failure.errors).toHaveLength(1);
    expect(failure.errors[0]).toBeInstanceOf(Error);
    expect((failure.errors[0] as Error).cause).toMatchObject({ message: 'socket close failed' });
    expect(close).toHaveBeenCalledWith(1000, 'Test world reset');
    expect(engine.getPlayer('pilot')).toBeDefined();
    expect(engine.getDiagnostics().players).toBe(1);
  });
});
