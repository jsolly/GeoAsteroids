import { expect, test } from 'vitest';
import { createBrowserScenarioHooks } from '../../utils/browser-scenario-setup';
import { TestConfig } from '../../utils/test-config';
import { ServerLogHelper } from '../../utils/server-log-helper';
import { bootTwoClientGames } from '../../utils/multi-client-setup';

const { browserManager, screenshotManager } = createBrowserScenarioHooks(__dirname);

test('complete laser communication flow works', async () => {
  const logLineOffset = ServerLogHelper.markLineOffset();
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

  await game1.fireLasersWithMouse(2, 1000);

  await game1.waitForServerLogPattern(/Server received shoot message/, logLineOffset);

  const lines = ServerLogHelper.linesSince(logLineOffset);
  const playerConnectMessages = lines.filter(
    (log) =>
      log.includes('Player added to game engine') ||
      log.includes('Broadcasted player joined')
  );
  const shootMessages = lines.filter((log) => log.includes('Server received shoot message'));

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

  expect(playerConnectMessages.length).toBeGreaterThanOrEqual(2);
  expect(shootMessages.length).toBeGreaterThan(0);
}, TestConfig.DEFAULT_TIMEOUT * 2);
