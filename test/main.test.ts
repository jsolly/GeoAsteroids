import { getPersonalBest, updatePersonalBest } from '../src/runtimeVars';
import { SAVE_KEY_PERSONAL_BEST } from '../src/config';
import { expect, test } from 'vitest';
import { GameState } from '../src/gameState';
const gameState = GameState.getInstance();

// Test that getPersonalBest returns 0 when local storage is empty
test.concurrent('getPersonalBest - initial', () => {
  localStorage.removeItem(SAVE_KEY_PERSONAL_BEST);
  expect(getPersonalBest()).toBe(0);
  expect(localStorage.getItem(SAVE_KEY_PERSONAL_BEST)).toBe('0');
});

// Test that getPersonalBest returns the score from local storage
test.concurrent('getPersonalBest - after setting a score', () => {
  localStorage.setItem(SAVE_KEY_PERSONAL_BEST, '100');
  expect(getPersonalBest()).toBe(100);
});

// Test that updatePersonalBest updates the score in local storage when the new score is higher
test.concurrent('updatePersonalBest - higher score', () => {
  localStorage.setItem(SAVE_KEY_PERSONAL_BEST, '100');
  gameState.updateCurrentScore(200);
  updatePersonalBest();
  expect(localStorage.getItem(SAVE_KEY_PERSONAL_BEST)).toBe('200');
});

// Test that updatePersonalBest does not update the score in local storage when the new score is lower
test.concurrent('updatePersonalBest - lower score', () => {
  gameState.resetCurrentScore();

  localStorage.setItem(SAVE_KEY_PERSONAL_BEST, '100');
  gameState.updateCurrentScore(-50);
  updatePersonalBest();
  expect(localStorage.getItem(SAVE_KEY_PERSONAL_BEST)).toBe('100');
});
