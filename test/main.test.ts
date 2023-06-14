import { expect, test, vi, beforeEach, afterEach } from 'vitest';
import { Ship } from '../src/ship.js';
import {
  startGame,
  gameOver,
  currScore,
  currLevel,
  updateCurrScore,
  newLevel,
} from '../src/main.js';

import { roidBelt } from '../src/asteroids.js';

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
