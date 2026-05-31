import { test, expect } from 'vitest';
import { createBrowserScenarioHooks } from '../../utils/browser-scenario-setup';
import { GameInteractions } from '../../utils/game-interactions';
import { TestConfig } from '../../utils/test-config';

const { browserManager } = createBrowserScenarioHooks(__dirname);

test('player health regenerates after damage', async () => {
  const page = browserManager.getCurrentPage();
  if (!page) throw new Error('Page not available');

  const game = new GameInteractions(page);
  await game.bootSinglePlayerGame();
  await game.waitForCombatReady();

  await game.applyServerChipDamage(25);
  await game.waitForShipHealth(75);

  const healed = await game.waitForHealthAbove(76, 15000);
  expect(healed).toBeGreaterThan(75);
}, TestConfig.DEFAULT_TIMEOUT);
