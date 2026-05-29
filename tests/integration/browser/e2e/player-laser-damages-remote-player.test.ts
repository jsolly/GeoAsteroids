import { test, expect } from 'vitest';
import { createBrowserScenarioHooks } from '../../utils/browser-scenario-setup';
import { GameInteractions } from '../../utils/game-interactions';
import { TestConfig } from '../../utils/test-config';

const { browserManager } = createBrowserScenarioHooks(__dirname);

test('player laser damages remote player', async () => {
  const page1 = browserManager.getCurrentPage();
  if (!page1) throw new Error('Page 1 not available');

  await browserManager.createPage();
  const page2 = browserManager.getCurrentPage();
  if (!page2) throw new Error('Page 2 not available');

  const game1 = new GameInteractions(page1);
  const game2 = new GameInteractions(page2);

  await game1.bootSinglePlayerGame();
  await game2.bootSinglePlayerGame();
  await game1.waitForCombatReady();
  await game2.waitForCombatReady();

  await expect.poll(() => game1.getRemoteHumanPlayerIds(), { timeout: 12000 }).not.toEqual([]);

  const targetId = (await game1.getRemoteHumanPlayerIds())[0];
  const healthBefore = await game2.getShipHealth();

  for (let i = 0; i < 3; i++) {
    await game1.fireLaserAtRemotePlayer(targetId);
    await page2.waitForTimeout(400);
    const current = await game2.getShipHealth();
    if (current < healthBefore) break;
  }

  expect(await game2.getShipHealth()).toBeLessThan(healthBefore);
}, TestConfig.DEFAULT_TIMEOUT * 2);
