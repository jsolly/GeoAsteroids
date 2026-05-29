import { test, expect } from 'vitest';
import { createBrowserScenarioHooks } from '../../utils/browser-scenario-setup';
import { GameInteractions } from '../../utils/game-interactions';
import { TestConfig } from '../../utils/test-config';

const { browserManager } = createBrowserScenarioHooks(__dirname);

test('killing remote player awards 200 points', async () => {
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
  const scoreBefore = await game1.getScore();

  for (let i = 0; i < 8; i++) {
    await game1.fireLaserAtRemotePlayer(targetId);
    await page2.waitForTimeout(350);
    const victimHealth = await game2.getShipHealth();
    if (victimHealth <= 0) break;
  }

  await expect
    .poll(() => game1.getScore(), { timeout: 10000, message: 'PvP kill should award 200 points' })
    .toBeGreaterThanOrEqual(scoreBefore + 200);
}, TestConfig.DEFAULT_TIMEOUT * 2);
