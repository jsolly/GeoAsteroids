import { expect, test } from 'vitest';
import { createBrowserScenarioHooks } from '../../utils/browser-scenario-setup';
import { GameInteractions } from '../../utils/game-interactions';
import { TestConfig } from '../../utils/test-config';

const { browserManager } = createBrowserScenarioHooks(__dirname);

test('player picks up fuel and EMP spends it', async () => {
  const page = browserManager.getCurrentPage();
  if (!page) {
    throw new Error('Page not available');
  }

  const game = new GameInteractions(page);
  await game.bootSinglePlayerGame();

  const startFuel = await game.getShipFuel();
  expect(startFuel).toBeGreaterThanOrEqual(0);

  await game.placeFuelDropOnLocalShip(25);
  await expect.poll(async () => game.getShipFuel(), { timeout: 4000 }).toBe(startFuel + 25);

  await page.keyboard.press('e');
  await expect.poll(async () => game.getShipFuel(), { timeout: 4000 }).toBeLessThan(startFuel + 25);
}, TestConfig.DEFAULT_TIMEOUT);
