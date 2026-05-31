import { test, expect } from 'vitest';
import { createBrowserScenarioHooks } from '../../utils/browser-scenario-setup';
import { GameInteractions } from '../../utils/game-interactions';
import { expectRandomRespawnPlacement } from '../../utils/respawn-assertions';
import { TestConfig } from '../../utils/test-config';

const { browserManager } = createBrowserScenarioHooks(__dirname);

const DEATH_POSITION = { x: 3150, y: 0 };

test('ship respawns at a random location after boundary death', async () => {
  const page = browserManager.getCurrentPage();
  if (!page) throw new Error('Page not available');

  const game = new GameInteractions(page);
  await game.bootSinglePlayerGame();
  await game.waitForCombatReady();

  const initialLives = await game.getLives();
  await game.placeShipAt(DEATH_POSITION.x, DEATH_POSITION.y);
  await game.syncShipPositionToServer();

  await expect
    .poll(() => game.getLives(), { timeout: 8000, message: 'boundary crossing should cost a life' })
    .toBeLessThan(initialLives);

  const afterDeath = await game.getShipPosition();
  const respawnPosition = await game.waitForServerRespawnAwayFrom(DEATH_POSITION, 90000, afterDeath);
  expectRandomRespawnPlacement(DEATH_POSITION, respawnPosition);
}, TestConfig.DEFAULT_TIMEOUT * 3);
