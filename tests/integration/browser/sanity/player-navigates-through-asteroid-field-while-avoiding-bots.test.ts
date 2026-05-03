import { test, beforeAll, afterAll, beforeEach, afterEach, expect } from 'vitest';
import { BrowserManager } from '../../utils/browser-manager';
import { ScreenshotManager } from '../../utils/screenshot-manager';
import { GameInteractions } from '../../utils/game-interactions';
import { TestConfig } from '../../utils/test-config';
import { HealthChecker } from '../../utils/health-checker';

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

// Scenario: Player navigates through asteroid field while avoiding bots
test('player navigates through asteroid field while avoiding bots', async () => {
  const page = browserManager.getCurrentPage();
  if (!page) throw new Error('Page not available');
  
  const game = new GameInteractions(page);
  
  // Navigate and start the game
  await game.navigateToGame();
  await game.startGame();
  await game.waitForGameInitialization(TestConfig.GAME_INIT_TIMEOUT);
  
  // Verify game elements
  await game.verifyGameCanvas();
  await game.verifyGameArea();
  
  // Wait for bots and asteroids to be created
  await page.waitForTimeout(3000);
  
  // Take initial screenshot
  const initialScreenshot = screenshotManager.getScreenshotPath(
    screenshotManager.getTimestampedFilename('navigate-asteroid-field-initial')
  );
  await page.screenshot({ path: initialScreenshot });
  
  // Scenario: Navigate through the asteroid field
  console.log('🎮 Starting navigation scenario...');
  
  // Move in a pattern to navigate around asteroids
  await game.moveShip('right', 200);
  await page.waitForTimeout(500);
  
  await game.moveShip('up', 150);
  await page.waitForTimeout(500);
  
  await game.moveShip('left', 100);
  await page.waitForTimeout(500);
  
  await game.moveShip('down', 100);
  await page.waitForTimeout(500);
  
  // Fire lasers to clear path through asteroids
  await game.fireLasers(3, 300);
  await page.waitForTimeout(1000);
  
  // Continue navigation
  await game.moveShip('right', 150);
  await page.waitForTimeout(500);
  
  await game.moveShip('up', 100);
  await page.waitForTimeout(500);
  
  // Take final screenshot
  const finalScreenshot = screenshotManager.getScreenshotPath(
    screenshotManager.getTimestampedFilename('navigate-asteroid-field-final')
  );
  await page.screenshot({ path: finalScreenshot });
  
  // Verify the player survived the navigation
  const shipHealth = await game.getShipHealth();
  expect(shipHealth).toBeGreaterThan(0);
  
  console.log('✅ Player successfully navigated through asteroid field while avoiding bots');
}, TestConfig.DEFAULT_TIMEOUT);
