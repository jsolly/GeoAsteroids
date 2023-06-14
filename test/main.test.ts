import { expect, test, vi, beforeEach, afterEach } from 'vitest';
import { Ship } from '../src/ship.js';
import {
  startGame,
  gameOver,
  currScore,
  currLevel,
  updateCurrScore,
  newLevel,
  newGame,
  showGameOverMenu,
} from '../src/main.js';
import { STARTING_SCORE, START_LEVEL } from '../src/config.js';

import { roidBelt } from '../src/asteroids.js';

const safeNewGame = newGame as () => void;
let testShip: Ship;
let testRoidBelt: roidBelt;
let mockFetch: (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

beforeEach(() => {
  mockFetch = vi.fn(() =>
    Promise.resolve(new Response(JSON.stringify({ ok: true }))),
  );
  global.fetch = mockFetch;

  testShip = new Ship();
  testRoidBelt = new roidBelt(testShip);
  startGame();
});

afterEach(() => {
  // Restore the original functions after each test
  vi.restoreAllMocks();
});

test.concurrent('Game Start', () => {
  expect(currScore).toBe(0);
  expect(currLevel).toBe(1);
});

test.concurrent('Game Over', () => {
  gameOver(testShip);
  expect(testShip.dead).toBe(true);
});

test.concurrent('Update Current Score', () => {
  const prevScore = currScore;
  const valToAdd = 50;
  updateCurrScore(valToAdd);
  expect(currScore).toBe(prevScore + valToAdd);
});

test.concurrent('New Level', () => {
  const prevLevel = currLevel;
  newLevel(testShip, testRoidBelt);
  expect(currLevel).toBe(prevLevel + 1);
});

test.concurrent('New Game', () => {
  safeNewGame();
  expect(currScore).toBe(STARTING_SCORE);
  expect(currLevel).toBe(START_LEVEL + 1);
});

test.concurrent('Show Game Over Menu', async () => {
  // The function should not throw an error
  await expect(showGameOverMenu()).resolves.not.toThrow();
});
