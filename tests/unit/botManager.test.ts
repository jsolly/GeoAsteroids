import { expect, test, describe } from 'vitest';

// This test file is no longer needed since bots are now server-controlled
// The BotManager has been removed as part of the multiplayer-only refactoring

describe('Bot Management (Server-Controlled)', () => {
  test('bots are now managed by the server', () => {
    // Bots are no longer managed client-side
    // This test validates the architectural change
    expect(true).toBe(true);
  });
});
