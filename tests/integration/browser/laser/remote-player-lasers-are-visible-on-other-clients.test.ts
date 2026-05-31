import { test } from 'vitest';
import { createBrowserScenarioHooks } from '../../utils/browser-scenario-setup';
import { TestConfig } from '../../utils/test-config';
import { bootTwoClientGames } from '../../utils/multi-client-setup';

const { browserManager, screenshotManager } = createBrowserScenarioHooks(__dirname);

test('remote player lasers are visible on other clients', async () => {
  const { page1, page2, game1 } = await bootTwoClientGames(browserManager);

  await page1.screenshot({
    path: screenshotManager.getScreenshotPath(
      screenshotManager.getTimestampedFilename('client1-before-lasers')
    ),
  });
  await page2.screenshot({
    path: screenshotManager.getScreenshotPath(
      screenshotManager.getTimestampedFilename('client2-before-lasers')
    ),
  });

  await game1.fireLasersWithMouse(3, 800);

  await page2.waitForFunction(
    () => {
      const gc = (window as any).gameController;
      const remotePlayers = gc?.getNetworkManager?.().getAllPlayers?.() ?? [];
      return remotePlayers.some((p: any) => (p.ship?.lasers?.length ?? 0) > 0);
    },
    undefined,
    { timeout: 15000, polling: 200 }
  );

  await page1.screenshot({
    path: screenshotManager.getScreenshotPath(
      screenshotManager.getTimestampedFilename('client1-after-lasers')
    ),
  });
  await page2.screenshot({
    path: screenshotManager.getScreenshotPath(
      screenshotManager.getTimestampedFilename('client2-after-lasers')
    ),
  });
}, TestConfig.DEFAULT_TIMEOUT * 2);
