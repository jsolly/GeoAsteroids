import { test, expect } from 'vitest';
import { createBrowserScenarioHooks } from '../../utils/browser-scenario-setup';
import { GameInteractions } from '../../utils/game-interactions';
import { expectRandomRespawnPlacement } from '../../utils/respawn-assertions';
import { TestConfig } from '../../utils/test-config';

const { browserManager } = createBrowserScenarioHooks(__dirname);

test('ship respawns at a random location after laser death', async () => {
  const page = browserManager.getCurrentPage();
  if (!page) throw new Error('Page not available');

  const game = new GameInteractions(page);
  await game.bootSinglePlayerGame();
  await game.waitForCombatReady();

  const initialLives = await game.getLives();
  const deathPosition = { x: 2800, y: 600 };
  await game.placeShipAt(deathPosition.x, deathPosition.y);
  await game.syncShipPositionToServer();
  await game.waitForCombatReady();

  await game.killLocalPlayerUntilLifeLost();

  expect(await game.getLives()).toBeLessThan(initialLives);

  const actualDeathPosition = await game.getShipPosition();
  const respawnPosition = await game.waitForShipRespawn(actualDeathPosition, 60000);
  expectRandomRespawnPlacement(actualDeathPosition, respawnPosition);
}, TestConfig.DEFAULT_TIMEOUT * 3);
