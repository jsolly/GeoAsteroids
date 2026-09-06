import { expect, test } from 'vitest';
import { createBrowserScenarioHooks } from '../../utils/browser-scenario-setup';
import { GameInteractions } from '../../utils/game-interactions';
import { TestConfig } from '../../utils/test-config';
import { ServerLogHelper } from '../../utils/server-log-helper';

const { browserManager, screenshotManager } = createBrowserScenarioHooks(__dirname);

// Test: Verify that server receives shoot messages
test('server receives and processes shoot messages', async () => {
  const page = browserManager.getCurrentPage();
  if (!page) throw new Error('Page not available');

  const game = new GameInteractions(page);
  const logLineOffset = ServerLogHelper.markLineOffset();

  const clientMessages: string[] = [];
  page.on('console', (msg) => {
    const text = msg.text();
    if (
      text.includes('NETWORK') ||
      text.includes('SHIP') ||
      text.includes('Sending shoot') ||
      text.includes('MOUSE') ||
      text.includes('INPUT')
    ) {
      clientMessages.push(text);
    }
  });

  await game.bootGame();

  await game.fireLasersWithMouse(3, 1000);

  const shootLogMatches = await game.waitForServerLogPattern(
    /Server received shoot message|broadcastPlayerShoot|handlePlayerShoot/,
    logLineOffset
  );

  const screenshotPath = screenshotManager.getScreenshotPath(
    screenshotManager.getTimestampedFilename('server-shoot-messages-test')
  );
  await page.screenshot({ path: screenshotPath });

  expect(shootLogMatches.length).toBeGreaterThan(0);
  console.log('📱 Client-side messages:', clientMessages);
}, TestConfig.DEFAULT_TIMEOUT);
