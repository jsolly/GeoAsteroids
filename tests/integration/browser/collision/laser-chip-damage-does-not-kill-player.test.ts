import { test, expect } from 'vitest';
import { createBrowserScenarioHooks } from '../../utils/browser-scenario-setup';
import { GameInteractions } from '../../utils/game-interactions';
import { TestConfig } from '../../utils/test-config';

const { browserManager } = createBrowserScenarioHooks(__dirname);

test('laser chip damage does not kill player', async () => {
  const page = browserManager.getCurrentPage();
  if (!page) throw new Error('Page not available');

  const game = new GameInteractions(page);
  await game.bootSinglePlayerGame();
  await game.waitForCombatReady();

  const livesBefore = await game.getLives();
  await game.applyLaserDamageToLocal(1, 25);

  await expect.poll(() => game.getShipHealth()).toBe(75);
  expect(await game.getLives()).toBe(livesBefore);
}, TestConfig.DEFAULT_TIMEOUT);
