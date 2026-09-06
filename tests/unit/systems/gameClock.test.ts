import { describe, expect, test } from 'vitest';
import {
  consumeTickAccumulator,
  GAME_TICK_MS,
  MAX_CATCH_UP_TICKS,
  ticksForElapsed,
} from '../../../shared/gameClock';

describe('game clock', () => {
  test('a sub-frame delta is not a tick — 144 Hz must not burn explode counters', () => {
    expect(ticksForElapsed(GAME_TICK_MS * 0.4)).toBe(0);
  });

  test('one 60 Hz interval is one tick', () => {
    expect(ticksForElapsed(GAME_TICK_MS)).toBe(1);
    expect(ticksForElapsed(1000)).toBe(60);
  });

  test('a hitch catches up instead of stalling, but not without a cap', () => {
    expect(ticksForElapsed(500)).toBe(30);
    expect(ticksForElapsed(10_000)).toBe(MAX_CATCH_UP_TICKS);
  });

  test('accumulator leaves the leftover milliseconds for the next frame', () => {
    const { frames, remainingMs } = consumeTickAccumulator(GAME_TICK_MS * 2.5);
    expect(frames).toBe(2);
    expect(remainingMs).toBeCloseTo(GAME_TICK_MS * 0.5, 8);
  });
});
