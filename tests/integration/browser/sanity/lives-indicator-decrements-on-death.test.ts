import { test, expect } from 'vitest';
import { createBrowserScenarioHooks } from '../../utils/browser-scenario-setup';
import { GameInteractions } from '../../utils/game-interactions';
import { TestConfig } from '../../utils/test-config';

const { browserManager } = createBrowserScenarioHooks(__dirname);

test('lives indicator decrements on death', async () => {
  const page = browserManager.getCurrentPage();
  if (!page) throw new Error('Page not available');

  const game = new GameInteractions(page);
  await game.bootSinglePlayerGame();
  await game.waitForCombatReady();

  expect(await game.getLives()).toBe(3);

  await game.killLocalPlayerWithLaserDamage(4, 25);

  await expect
    .poll(() => game.getLives(), { timeout: 8000, message: 'death should decrement lives' })
    .toBe(2);
}, TestConfig.DEFAULT_TIMEOUT);
