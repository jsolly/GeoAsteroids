import { expect, test } from 'vitest';
import { createBrowserScenarioHooks } from '../../utils/browser-scenario-setup';
import { TestConfig } from '../../utils/test-config';
import { bootTwoClientGames } from '../../utils/multi-client-setup';

const { browserManager, screenshotManager } = createBrowserScenarioHooks(__dirname);

// Test: Laser network communication between two clients
test('laser communication works between multiple clients', async () => {
  const { page1, page2, game1 } = await bootTwoClientGames(browserManager);

  const page1Messages: string[] = [];
  const page2Messages: string[] = [];

  page1.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('NETWORK') || text.includes('shoot') || text.includes('laser')) {
      page1Messages.push(text);
    }
  });

  page2.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('NETWORK') || text.includes('shoot') || text.includes('laser')) {
      page2Messages.push(text);
    }
  });

  await game1.fireLasersWithMouse(2, 1000);

  await page2.waitForFunction(
    () => {
      const gc = (window as any).gameController;
      const remotePlayers = gc?.getNetworkManager?.().getAllPlayers?.() ?? [];
      return remotePlayers.some((p: any) => (p.ship?.lasers?.length ?? 0) > 0);
    },
    undefined,
    { timeout: 15000, polling: 200 }
  );

  const screenshot1Path = screenshotManager.getScreenshotPath(
    screenshotManager.getTimestampedFilename('client1-laser-communication-test')
  );
  await page1.screenshot({ path: screenshot1Path });

  const screenshot2Path = screenshotManager.getScreenshotPath(
    screenshotManager.getTimestampedFilename('client2-laser-communication-test')
  );
  await page2.screenshot({ path: screenshot2Path });

  const client1ShootMessages = page1Messages.filter(
    (msg) => msg.includes('Sending shoot message to server') || msg.includes('Sending shoot event')
  );
  const client2ReceiveMessages = page2Messages.filter(
    (msg) =>
      msg.includes('Client received playerShoot message') || msg.includes('Added laser to remote player')
  );

  expect(client1ShootMessages.length).toBeGreaterThan(0);
  expect(client2ReceiveMessages.length + (await page2.evaluate(() => {
    const gc = (window as any).gameController;
    const remotePlayers = gc?.getNetworkManager?.().getAllPlayers?.() ?? [];
    return remotePlayers.reduce((sum: number, p: any) => sum + (p.ship?.lasers?.length ?? 0), 0);
  }))).toBeGreaterThan(0);
}, TestConfig.DEFAULT_TIMEOUT * 2);
