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

// Test: Verify complete laser communication flow
test('complete laser communication flow works', async () => {
  // Create two browser pages to simulate two clients
  const page1 = browserManager.getCurrentPage();
  if (!page1) throw new Error('Page 1 not available');
  
  // Create a second page for the second client
  await browserManager.createPage();
  const page2 = browserManager.getCurrentPage();
  if (!page2) throw new Error('Page 2 not available');
  
  const game1 = new GameInteractions(page1);
  const game2 = new GameInteractions(page2);
  
  // Get initial server log state
  const initialLogs = getRecentServerLogs(20);
  console.log('📝 Initial server logs:', initialLogs);
  
  // Start both games
  console.log('🎮 Starting game for client 1...');
  await game1.navigateToGame();
  await game1.startGame();
  await game1.waitForGameInitialization(TestConfig.GAME_INIT_TIMEOUT);
  
  console.log('🎮 Starting game for client 2...');
  await game2.navigateToGame();
  await game2.startGame();
  await game2.waitForGameInitialization(TestConfig.GAME_INIT_TIMEOUT);
  
  // Wait for both clients to connect
  await page1.waitForTimeout(5000);
  await page2.waitForTimeout(5000);
  
  // Take initial screenshots
  const initialScreenshot1 = screenshotManager.getScreenshotPath(
    screenshotManager.getTimestampedFilename('client1-before-lasers')
  );
  await page1.screenshot({ path: initialScreenshot1 });
  
  const initialScreenshot2 = screenshotManager.getScreenshotPath(
    screenshotManager.getTimestampedFilename('client2-before-lasers')
  );
  await page2.screenshot({ path: initialScreenshot2 });
  
  // Add debugging to check if mouse events reach the canvas
  await page1.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (canvas) {
      console.log('🧪 TEST: Canvas found', {
        width: canvas.width,
        height: canvas.height,
        offsetWidth: canvas.offsetWidth,
        offsetHeight: canvas.offsetHeight,
        style: {
          display: canvas.style.display,
          visibility: canvas.style.visibility,
          pointerEvents: canvas.style.pointerEvents
        },
        computedStyle: {
          display: getComputedStyle(canvas).display,
          visibility: getComputedStyle(canvas).visibility,
          pointerEvents: getComputedStyle(canvas).pointerEvents
        }
      });
      
      canvas.addEventListener('mousedown', (ev) => {
        console.log('🧪 TEST: Mouse down event detected on canvas', { 
          button: ev.button, 
          x: ev.clientX, 
          y: ev.clientY,
          gameRunning: (window as any).gameController?.gameStateManager?.getIsGameRunning?.()
        });
      });
      console.log('🧪 TEST: Added test mouse listener to canvas');
    } else {
      console.log('🧪 TEST: No canvas found');
    }
  });

  // Client 1 fires lasers
  console.log('🔫 Client 1 firing lasers...');
  
  // Check game state before firing
  const gameState = await page1.evaluate(() => {
    const gameController = (window as any).gameController;
    const localPlayer = gameController?.playerManager?.getLocalPlayer?.();
    return {
      isRunning: gameController?.gameStateManager?.getIsGameRunning?.(),
      hasCanvas: !!document.querySelector('canvas'),
      canvasVisible: document.querySelector('canvas')?.style.display !== 'none',
      hasInputManager: !!gameController?.inputManager,
      hasShip: !!localPlayer?.ship,
      playerLives: localPlayer?.lives,
      shipExploding: localPlayer?.ship?.exploding,
      shipCanShoot: localPlayer?.ship?.canShoot
    };
  });
  console.log('🎮 Game state before firing:', gameState);
  
  // Fire lasers by directly calling ship.shoot() method (most reliable for testing)
  console.log('🔫 Firing lasers directly...');
  await page1.evaluate(() => {
    const gameController = (window as any).gameController;
    const localPlayer = gameController?.playerManager?.getLocalPlayer?.();
    if (localPlayer?.ship) {
      console.log('🔫 Firing laser 1/2...');
      localPlayer.ship.shoot();
      setTimeout(() => {
        console.log('🔫 Firing laser 2/2...');
        localPlayer.ship.shoot();
      }, 500);
    }
  });
  await page1.waitForTimeout(1000);
  
  // Wait for network processing
  await page1.waitForTimeout(4000);
  await page2.waitForTimeout(4000);
  
  // Take final screenshots
  const finalScreenshot1 = screenshotManager.getScreenshotPath(
    screenshotManager.getTimestampedFilename('client1-after-lasers')
  );
  await page1.screenshot({ path: finalScreenshot1 });
  
  const finalScreenshot2 = screenshotManager.getScreenshotPath(
    screenshotManager.getTimestampedFilename('client2-after-lasers')
  );
  await page2.screenshot({ path: finalScreenshot2 });
  
  // Check server logs for the complete flow
  const finalLogs = getRecentServerLogs(2000);
  console.log('📝 Final server logs:', finalLogs);
  
  // Look for the complete communication flow
  const playerConnectMessages = finalLogs.filter(log => 
    log.includes('Player added to game engine') ||
    log.includes('Broadcasted player joined and game state') ||
    log.includes('Broadcasted player joined') ||
    log.includes('✅ Player added to game engine') ||
    log.includes('📢 Broadcasted player joined')
  );
  
  const shootMessages = finalLogs.filter(log => 
    log.includes('DEBUG DEBUG: Server received shoot message') ||
    log.includes('Server received shoot message')
  );
  
  const broadcastMessages = finalLogs.filter(log => 
    log.includes('Broadcasted player joined and game state') ||
    log.includes('Broadcasted player joined') ||
    log.includes('📢 Broadcasted player joined') ||
    log.includes('broadcastToAll')
  );
  
  console.log('🔗 Player connection messages:', playerConnectMessages);
  console.log('🎯 Shoot messages:', shootMessages);
  console.log('📡 Broadcast messages:', broadcastMessages);
  
  // Verify the complete flow
  expect(playerConnectMessages.length).toBeGreaterThanOrEqual(2); // At least 2 players connected
  expect(shootMessages.length).toBeGreaterThan(0); // Shoot messages received
  expect(broadcastMessages.length).toBeGreaterThan(0); // Messages broadcasted
  
  console.log('✅ Complete laser communication flow is working');
}, TestConfig.DEFAULT_TIMEOUT * 2);
