import { expect, test } from 'vitest';
import {
  CONNECTION_STALE_TIMEOUT_MS,
  isConnectionStale,
} from '../../../src/network/services/connectionHealth';

// Detects the "silent WS degradation" seen live: a half-open socket the browser
// still reports as connected while no server traffic arrives.
test('a recently-heard connection is not stale', () => {
  const now = 100_000;
  expect(isConnectionStale(now - 1_000, now)).toBe(false);
});

test('a connection with no traffic past the timeout is stale', () => {
  const now = 100_000;
  expect(isConnectionStale(now - (CONNECTION_STALE_TIMEOUT_MS + 1), now)).toBe(true);
});

test('exactly at the timeout is not yet stale (strictly greater)', () => {
  const now = 100_000;
  expect(isConnectionStale(now - CONNECTION_STALE_TIMEOUT_MS, now)).toBe(false);
});

test('honors a custom timeout', () => {
  expect(isConnectionStale(0, 5_000, 4_000)).toBe(true);
  expect(isConnectionStale(0, 3_000, 4_000)).toBe(false);
});
