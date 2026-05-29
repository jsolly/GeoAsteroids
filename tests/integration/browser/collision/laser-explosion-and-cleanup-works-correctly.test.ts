import { test, expect } from 'vitest';
import { createBrowserScenarioHooks } from '../../utils/browser-scenario-setup';
import { GameInteractions } from '../../utils/game-interactions';
import { TestConfig } from '../../utils/test-config';

const { browserManager } = createBrowserScenarioHooks(__dirname);

test('laser explosion and cleanup works correctly', async () => {
  const page = browserManager.getCurrentPage();
  if (!page) throw new Error('Page not available');

  const game = new GameInteractions(page);
  await game.bootSinglePlayerGame();
  await game.waitForCombatReady();

  expect(await game.getLocalLaserCount()).toBe(0);

  await game.fireLasersWithMouse(1);
  await expect
    .poll(() => game.getLocalLaserCount(), { timeout: 3000, message: 'firing should create a laser' })
    .toBeGreaterThan(0);

  await expect
    .poll(() => game.getLocalLaserCount(), { timeout: 8000, message: 'laser should expire after travel' })
    .toBe(0);
}, TestConfig.DEFAULT_TIMEOUT);
