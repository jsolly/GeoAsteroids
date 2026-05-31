import { expect, test } from 'vitest';
import { createBrowserScenarioHooks } from '../../utils/browser-scenario-setup';
import { TestConfig } from '../../utils/test-config';
import { bootTwoClientGames } from '../../utils/multi-client-setup';

const { browserManager, screenshotManager } = createBrowserScenarioHooks(__dirname);

test('complete laser network flow works end-to-end', async () => {
  const page1Messages: { type: string; message: string; timestamp: number }[] = [];
  const page2Messages: { type: string; message: string; timestamp: number }[] = [];

  const { page1, page2, game1 } = await bootTwoClientGames(browserManager);

  page1.on('console', (msg) => {
    const text = msg.text();
    if (
      text.includes('MOUSE') ||
      text.includes('SHIP') ||
      text.includes('NETWORK') ||
      text.includes('shoot') ||
      text.includes('laser') ||
      text.includes('GAME_CONTROLLER')
    ) {
      page1Messages.push({ type: msg.type(), message: text, timestamp: Date.now() });
    }
  });

  page2.on('console', (msg) => {
    const text = msg.text();
    if (
      text.includes('MOUSE') ||
      text.includes('SHIP') ||
      text.includes('NETWORK') ||
      text.includes('shoot') ||
      text.includes('laser') ||
      text.includes('GAME_CONTROLLER')
    ) {
      page2Messages.push({ type: msg.type(), message: text, timestamp: Date.now() });
    }
  });

  await page1.screenshot({
    path: screenshotManager.getScreenshotPath(
      screenshotManager.getTimestampedFilename('client1-initial-state')
    ),
  });
  await page2.screenshot({
    path: screenshotManager.getScreenshotPath(
      screenshotManager.getTimestampedFilename('client2-initial-state')
    ),
  });

  await game1.fireLasersWithMouse(3, 1000);

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

  const client1ShootMessages = page1Messages.filter(
    (msg) =>
      msg.message.includes('Left mouse click - shooting') ||
      msg.message.includes('Shoot method called') ||
      msg.message.includes('Sending shoot event') ||
      msg.message.includes('Sending shoot message to server')
  );

  const client2ReceiveMessages = page2Messages.filter(
    (msg) =>
      msg.message.includes('Client received playerShoot message') ||
      msg.message.includes('Added laser to remote player') ||
      msg.message.includes('Player shot laser')
  );

  const remoteLaserCount = await page2.evaluate(() => {
    const gc = (window as any).gameController;
    const remotePlayers = gc?.getNetworkManager?.().getAllPlayers?.() ?? [];
    return remotePlayers.reduce((sum: number, p: any) => sum + (p.ship?.lasers?.length ?? 0), 0);
  });

  expect(client1ShootMessages.length + remoteLaserCount).toBeGreaterThan(0);
  expect(client2ReceiveMessages.length + remoteLaserCount).toBeGreaterThan(0);
}, TestConfig.DEFAULT_TIMEOUT * 3);
