import { test, expect } from 'vitest';
import { createBrowserScenarioHooks } from '../../utils/browser-scenario-setup';
import { GameInteractions } from '../../utils/game-interactions';
import { expectRandomRespawnPlacement } from '../../utils/respawn-assertions';
import { TestConfig } from '../../utils/test-config';

const { browserManager } = createBrowserScenarioHooks(__dirname);

test('ship respawns at a random location after asteroid collision death', async () => {
  const page = browserManager.getCurrentPage();
  if (!page) throw new Error('Page not available');

  const game = new GameInteractions(page);
  await game.bootGame();
  await game.waitForCombatReady();

  const initialLives = await game.getLives();
  await game.waitForAsteroids(1);
  const asteroid = (await game.getAsteroidPositions())[0];
  expect(asteroid).toBeTruthy();
  if (!asteroid) return;

  const deathPosition = { x: asteroid.x, y: asteroid.y };
  await game.crashShipIntoAsteroidUntilDestroyed(asteroid);

  await expect
    .poll(() => game.getLives(), { timeout: 15000, message: 'asteroid collision should cost a life' })
    .toBeLessThan(initialLives);

  const afterDeath = await game.getShipPosition();
  const respawnPosition = await game.waitForServerRespawnAwayFrom(deathPosition, 90000, afterDeath);
  expectRandomRespawnPlacement(deathPosition, respawnPosition);
}, TestConfig.DEFAULT_TIMEOUT * 3);
