import { expect, test } from 'vitest';
import { Point, getPersonalBest, updatePersonalBest } from '../src/utils';
import { SAVE_KEY_PERSONAL_BEST } from '../src/config';

test.concurrent('Point Creation', () => {
  const firstPoint = new Point(10, 20);
  expect(firstPoint.x).toBe(10);
});

test.concurrent('Point distance calculation - non-zero distance', () => {
  const firstPoint = new Point(0, 0);
  const secondPoint = new Point(3, 4);
  expect(firstPoint.distToPoint(secondPoint)).toBe(5);
});

test.concurrent('Zero Point Distance', () => {
  const firstPoint = new Point(10, 20);
  const secondPoint = new Point(10, 20);
  expect(firstPoint.distToPoint(secondPoint)).toBe(0);
});
test.concurrent('Point Distance - Many', () => {
  const firstPoint = new Point(0, 0);
  const secondPoint = new Point(1000, 2000);
  expect(firstPoint.distToPoint(secondPoint)).toBe(2236);
});

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
  updatePersonalBest(200);
  expect(localStorage.getItem(SAVE_KEY_PERSONAL_BEST)).toBe('200');
});

// Test that updatePersonalBest does not update the score in local storage when the new score is lower
test.concurrent('updatePersonalBest - lower score', () => {
  localStorage.setItem(SAVE_KEY_PERSONAL_BEST, '100');
  updatePersonalBest(50);
  expect(localStorage.getItem(SAVE_KEY_PERSONAL_BEST)).toBe('100');
});
