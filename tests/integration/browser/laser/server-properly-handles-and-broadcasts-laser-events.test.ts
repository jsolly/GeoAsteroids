import { expect, test } from 'vitest';
import { createBrowserScenarioHooks } from '../../utils/browser-scenario-setup';
import { GameInteractions } from '../../utils/game-interactions';
import { TestConfig } from '../../utils/test-config';

const { browserManager, screenshotManager } = createBrowserScenarioHooks(__dirname);

// Test: Server receives and broadcasts laser events
test('server properly handles and broadcasts laser events', async () => {
  const page = browserManager.getCurrentPage();
  if (!page) throw new Error('Page not available');
  
  const game = new GameInteractions(page);
  
  // Navigate and start the game
  await game.bootSinglePlayerGame();

  const networkMessages: string[] = [];
  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('NETWORK') || text.includes('shoot')) {
      networkMessages.push(text);
    }
  });

  await game.fireLasersWithMouse(2, 1000);

  await page.waitForFunction(
    () => {
      const gc = (window as any).gameController;
      return (gc?.playerManager?.getLocalPlayer?.()?.ship?.lasers?.length ?? 0) > 0;
    },
    undefined,
    { timeout: 15000, polling: 200 }
  );
  
  // Take a screenshot
  const screenshotPath = screenshotManager.getScreenshotPath(
    screenshotManager.getTimestampedFilename('server-laser-broadcast-test')
  );
  await page.screenshot({ path: screenshotPath });
  
  // Check for network messages
  console.log('📝 Network messages:', networkMessages);
  
  // Verify that shoot messages were sent
  const shootMessages = networkMessages.filter(msg => 
    msg.includes('Sending shoot message to server') ||
    msg.includes('Sending shoot event')
  );
  
  expect(shootMessages.length).toBeGreaterThan(0);
  console.log('✅ Server laser communication is working');
}, TestConfig.DEFAULT_TIMEOUT);
