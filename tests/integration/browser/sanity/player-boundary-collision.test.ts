import { expect, test } from 'vitest';
import { createBrowserScenarioHooks } from '../../utils/browser-scenario-setup';
import { GameInteractions } from '../../utils/game-interactions';
import { TestConfig } from '../../utils/test-config';

const { browserManager } = createBrowserScenarioHooks(__dirname);

// Scenario: a player that crosses the circular world boundary is destroyed,
// loses a life, and respawns back inside the playfield.
test('player explodes when hitting boundary', async () => {
  const page = browserManager.getCurrentPage();
  if (!page) throw new Error('Page not available');

  const game = new GameInteractions(page);

  await game.navigateToGame();
  await game.startGame();
  await game.waitForGameInitialization(TestConfig.GAME_INIT_TIMEOUT);
  await game.waitForGameReady();

  const initialLives = await game.getLives();
  expect(initialLives).toBe(3);

  // Wait out spawn protection so the boundary hit is fatal immediately.
  await game.waitForCombatReady();

  // Place the ship just outside the circular boundary (radius 3100). The
  // client's boundary check should detect this and report a fatal hit.
  await game.placeShipAt(3150, 0);

  // The player loses a life from the boundary collision.
  await expect
    .poll(() => game.getLives(), { timeout: 8000, message: 'crossing the boundary should cost a life' })
    .toBeLessThan(initialLives);

  // After the death/respawn cycle the server repositions the player inside the arena.
  await expect
    .poll(async () => {
      await game.runGameFrames(15);
      return game.getShipDistanceFromCenter();
    }, {
      timeout: 90000,
      message: 'player should respawn inside the boundary',
    })
    .toBeLessThan(3100);

  await expect
    .poll(async () => {
      await game.runGameFrames(10);
      return game.getShipHealth();
    }, { timeout: 90000, message: 'player should respawn with health' })
    .toBeGreaterThan(0);
}, TestConfig.DEFAULT_TIMEOUT * 3);
