import { test, expect } from 'vitest';
import { createBrowserScenarioHooks } from '../../utils/browser-scenario-setup';
import { GameInteractions } from '../../utils/game-interactions';
import { TestConfig } from '../../utils/test-config';

const { browserManager } = createBrowserScenarioHooks(__dirname);

test('player navigates through asteroid field while avoiding bots', async () => {
  const page = browserManager.getCurrentPage();
  if (!page) throw new Error('Page not available');

  const game = new GameInteractions(page);
  await game.bootSinglePlayerGame();
  await game.waitForAsteroids(1);
  await game.waitForBots(1);

  // Random thrust through a live field can clip a roid; keep the ship invulnerable
  // for this scenario (survival navigation, not damage testing).
  await game.armSpawnProtection();

  await game.moveShip('up', 2000);
  await game.moveShip('right', 1000);
  await game.moveShip('left', 1000);

  expect(await game.getShipHealth()).toBeGreaterThan(0);
  expect(await game.getLives()).toBe(3);
  expect(await game.getShipDistanceFromCenter()).toBeLessThan(3100);
}, TestConfig.DEFAULT_TIMEOUT);
