import { test, beforeAll, afterAll, beforeEach, afterEach, expect } from 'vitest';
import { BrowserManager } from '../../utils/browser-manager';
import { ScreenshotManager } from '../../utils/screenshot-manager';
import { GameInteractions } from '../../utils/game-interactions';
import { TestConfig } from '../../utils/test-config';
import { HealthChecker } from '../../utils/health-checker';
import { readFileSync } from 'fs';
import { join } from 'path';

// Test infrastructure
const browserManager = new BrowserManager();
const screenshotManager = new ScreenshotManager(__dirname);

// Test setup and teardown
beforeAll(async () => {
  // Check if required servers are running before starting tests
  console.log('🔍 Checking server health...');
  
  try {
    await HealthChecker.checkAllServers();
    console.log('✅ All servers are healthy!');
  } catch (error) {
    console.error('❌ Server health check failed:', error);
    console.error('\n🚀 To run integration tests, start the servers first:');
    console.error('   npm run dev');
    console.error('\n   Then in another terminal, run:');
    console.error('   npm run test:integration');
    throw error;
  }
  
  // Clear screenshots before starting tests
  screenshotManager.clearScreenshots();
  
  // Initialize browser
  await browserManager.initialize();
});

afterAll(async () => {
  await browserManager.cleanup();
});

beforeEach(async () => {
  // Create a new page for each test
  await browserManager.createPage();
});

afterEach(async () => {
  // Close the current page
  await browserManager.closePage();
});

// Helper function to read server logs
function readServerLogs(): string {
  try {
    const logPath = join(process.cwd(), 'logs', 'server.log');
    return readFileSync(logPath, 'utf-8');
  } catch (error) {
    console.warn('Could not read server logs:', error);
    return '';
  }
}

// Helper function to get recent server log entries
function getRecentServerLogs(lines: number = 50): string[] {
  const logs = readServerLogs();
  return logs.split('\n').slice(-lines).filter(line => line.trim());
}

// Test: Verify that server receives shoot messages
test('server receives and processes shoot messages', async () => {
  const page = browserManager.getCurrentPage();
  if (!page) throw new Error('Page not available');
  
  const game = new GameInteractions(page);
  
  // Set up client-side console message tracking
  const clientMessages: string[] = [];
  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('NETWORK') || text.includes('SHIP') || text.includes('Sending shoot') || text.includes('MOUSE') || text.includes('INPUT')) {
      clientMessages.push(text);
    }
  });
  
  // Get initial server log state
  const initialLogs = getRecentServerLogs(20);
  console.log('📝 Initial server logs:', initialLogs);
  
  // Navigate and start the game
  await game.navigateToGame();
  await game.startGame();
  await game.waitForGameInitialization(TestConfig.GAME_INIT_TIMEOUT);
  
  // Wait for game to be fully initialized
  await page.waitForTimeout(3000);
  
  // Check if game is running before firing lasers
  const isGameRunning = await page.evaluate(() => {
    // Access the game state through the global game controller
    const gameController = (window as any).gameController;
    if (gameController && gameController.gameStateManager) {
      return gameController.gameStateManager.getIsGameRunning();
    }
    return false;
  });
  console.log('🎮 Game running state:', isGameRunning);
  
  // Add a test mouse event listener to see if events are being fired
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (canvas) {
      console.log('🧪 TEST: Canvas found', {
        width: canvas.width,
        height: canvas.height,
        offsetWidth: canvas.offsetWidth,
        offsetHeight: canvas.offsetHeight,
        style: canvas.style.cssText,
        visible: canvas.offsetParent !== null
      });
      
      canvas.addEventListener('mousedown', (ev) => {
        console.log('🧪 TEST: Mouse down event detected on canvas', { button: ev.button, x: ev.clientX, y: ev.clientY });
      });
      console.log('🧪 TEST: Added test mouse listener to canvas');
    } else {
      console.log('🧪 TEST: No canvas found');
    }
  });
  
  // Fire lasers
  console.log('🔫 Firing lasers to test server communication...');
  await game.fireLasersWithMouse(3, 1000);
  
  // Wait for network processing
  await page.waitForTimeout(3000);
  
  // Take a screenshot
  const screenshotPath = screenshotManager.getScreenshotPath(
    screenshotManager.getTimestampedFilename('server-shoot-messages-test')
  );
  await page.screenshot({ path: screenshotPath });
  
  // Check server logs for shoot messages
  const finalLogs = getRecentServerLogs(500);
  console.log('📝 Final server logs:', finalLogs);
  
  // Look for shoot-related messages in server logs
  // The server logs are split across multiple lines, so we need to check the full log content
  const fullLogContent = finalLogs.join('\n');
  const shootMessages = finalLogs.filter(log => 
    log.includes('DEBUG DEBUG: Server received shoot message') ||
    log.includes('Server received shoot message') ||
    log.includes('broadcastPlayerShoot') ||
    log.includes('handlePlayerShoot')
  );
  
  // Also check for shoot messages in the full log content (multi-line)
  const multiLineShootMessages = fullLogContent.match(/DEBUG DEBUG: Server received shoot message/g) || [];
  
  console.log('🎯 Shoot messages found in server logs (single-line):', shootMessages);
  console.log('🎯 Shoot messages found in server logs (multi-line):', multiLineShootMessages.length);
  console.log('📱 Client-side messages:', clientMessages);
  
  // Verify that shoot messages were received (check both single-line and multi-line)
  const totalShootMessages = shootMessages.length + multiLineShootMessages.length;
  expect(totalShootMessages).toBeGreaterThan(0);
  console.log('✅ Server is receiving and processing shoot messages');
}, TestConfig.DEFAULT_TIMEOUT);
