import { test, expect } from 'vitest';
import { createBrowserScenarioHooks } from '../../utils/browser-scenario-setup';
import { GameInteractions } from '../../utils/game-interactions';
import { TestConfig } from '../../utils/test-config';

const { browserManager } = createBrowserScenarioHooks(__dirname);

test('mouse input handling works for laser firing', async () => {
  const page = browserManager.getCurrentPage();
  if (!page) throw new Error('Page not available');

  const game = new GameInteractions(page);
  await game.bootGame();
  await game.waitForCombatReady();

  const before = await game.getLaserCount();
  await game.fireLasersWithMouse(1, 200);
  await expect
    .poll(
      async () => {
        await game.runGameFrames(8);
        return game.getLaserCount();
      },
      { timeout: 15000, message: 'left click should create a laser' }
    )
    .toBeGreaterThan(before);
}, TestConfig.DEFAULT_TIMEOUT);
