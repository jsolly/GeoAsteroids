import { expect, test } from 'vitest';
import { GameStateManager } from '../../src/core/services/GameStateManager';

const gameState = GameStateManager.getInstance();

// Test that getCurrentScore returns initial score
test('getCurrentScore - initial', () => {
  gameState.resetCurrentScore();
  expect(gameState.getCurrentScore()).toBe(0);
});

// Test that updateCurrentScore adds to the current score
test('updateCurrentScore - add points', () => {
  gameState.resetCurrentScore();
  gameState.updateCurrentScore(100);
  expect(gameState.getCurrentScore()).toBe(100);
});

// Test that updateCurrentScore can add multiple times
test('updateCurrentScore - multiple additions', () => {
  gameState.resetCurrentScore();
  gameState.updateCurrentScore(50);
  gameState.updateCurrentScore(25);
  expect(gameState.getCurrentScore()).toBe(75);
});

// Test that resetCurrentScore resets to zero
test('resetCurrentScore - reset to initial', () => {
  gameState.updateCurrentScore(200);
  gameState.resetCurrentScore();
  expect(gameState.getCurrentScore()).toBe(0);
});
