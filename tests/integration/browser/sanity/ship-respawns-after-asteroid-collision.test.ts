import { test, expect } from 'vitest';
import { createBrowserScenarioHooks } from '../../utils/browser-scenario-setup';
import { GameInteractions } from '../../utils/game-interactions';
import { TestConfig } from '../../utils/test-config';

const { browserManager } = createBrowserScenarioHooks(__dirname);

// Scenario: a player who is destroyed by repeated asteroid collisions loses a
// life and then respawns — back to full health, inside the boundary.
test('ship respawns after asteroid collision when spawn protection ends', async () => {
  const page = browserManager.getCurrentPage();
  if (!page) throw new Error('Page not available');

  const game = new GameInteractions(page);
  await game.bootSinglePlayerGame();

  expect(await game.getShipHealth()).toBe(100);

  await game.waitForCombatReady();
  const initialLives = await game.getLives();

  await game.waitForAsteroids(1);
  const asteroid = (await game.getAsteroidPositions())[0];
  expect(asteroid).toBeTruthy();

  await game.crashShipIntoAsteroidUntilDestroyed(asteroid);

  await expect
    .poll(() => game.getLives(), { timeout: 8000, message: 'destruction should cost a life' })
    .toBeLessThan(initialLives);

  await expect
    .poll(() => game.getShipHealth(), { timeout: 12000, message: 'ship should respawn at full health' })
    .toBe(100);
  expect(await game.isShipExploding()).toBe(false);
  await expect
    .poll(() => game.getShipDistanceFromCenter(), {
      timeout: 12000,
      message: 'ship should respawn inside the boundary',
    })
    .toBeLessThan(3100);
}, TestConfig.DEFAULT_TIMEOUT);
