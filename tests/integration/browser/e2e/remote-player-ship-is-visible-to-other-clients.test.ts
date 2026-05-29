import { test, expect } from 'vitest';
import { createBrowserScenarioHooks } from '../../utils/browser-scenario-setup';
import { GameInteractions } from '../../utils/game-interactions';
import { TestConfig } from '../../utils/test-config';

const { browserManager } = createBrowserScenarioHooks(__dirname);

test('remote player ship is visible to other clients', async () => {
  const page1 = browserManager.getCurrentPage();
  if (!page1) throw new Error('Page 1 not available');

  await browserManager.createPage();
  const page2 = browserManager.getCurrentPage();
  if (!page2) throw new Error('Page 2 not available');

  const game1 = new GameInteractions(page1);
  const game2 = new GameInteractions(page2);

  await game1.bootSinglePlayerGame();
  await game2.bootSinglePlayerGame();

  await expect
    .poll(() => game1.getAllPlayerCount(), { timeout: 12000, message: 'both players should see each other' })
    .toBeGreaterThanOrEqual(2);

  const remoteIdsOnClient1 = await game1.getRemoteHumanPlayerIds();
  const targetId =
    remoteIdsOnClient1[0] ??
    (await game2.getLocalPlayerId());

  const startPos = await game2.getShipPosition();
  await game2.moveShip('up', 1200);
  await page2.waitForTimeout(500);

  await expect
    .poll(
      async () => {
        const remoteHealth = await game1.getPlayerHealthById(targetId);
        const pos = await game2.getShipPosition();
        return Math.hypot(pos.x - startPos.x, pos.y - startPos.y) > 5 && remoteHealth > 0;
      },
      { timeout: 8000, message: 'client 1 should still track client 2 after movement' }
    )
    .toBe(true);
}, TestConfig.DEFAULT_TIMEOUT * 2);
