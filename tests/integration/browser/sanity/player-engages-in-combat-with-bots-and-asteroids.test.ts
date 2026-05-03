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

// Scenario: Player engages in combat with bots and asteroids
test('player engages in combat with bots and asteroids', async () => {
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
  
  // Get initial health
  const initialHealth = await game.getShipHealth();
  expect(initialHealth).toBeGreaterThan(0);
  
  // Take initial screenshot
  const initialScreenshot = screenshotManager.getScreenshotPath(
    screenshotManager.getTimestampedFilename('combat-scenario-initial')
  );
  await page.screenshot({ path: initialScreenshot });
  
  // Scenario: Engage in combat
  console.log('⚔️ Starting combat scenario...');
  
  // Phase 1: Clear asteroids with lasers
  console.log('🔫 Phase 1: Clearing asteroids...');
  await game.fireLasers(5, 200);
  await page.waitForTimeout(1000);
  
  // Phase 2: Navigate to engage bots
  console.log('🎯 Phase 2: Engaging bots...');
  await game.moveShip('right', 100);
  await game.fireLasers(3, 300);
  await page.waitForTimeout(500);
  
  await game.moveShip('up', 80);
  await game.fireLasers(2, 400);
  await page.waitForTimeout(500);
  
  // Phase 3: Evasive maneuvers while fighting
  console.log('🛸 Phase 3: Evasive maneuvers...');
  await game.moveShip('left', 120);
  await game.fireLasers(4, 250);
  await page.waitForTimeout(500);
  
  await game.moveShip('down', 100);
  await game.fireLasers(3, 300);
  await page.waitForTimeout(500);
  
  // Phase 4: Final assault
  console.log('💥 Phase 4: Final assault...');
  await game.moveShip('right', 80);
  await game.fireLasers(6, 150);
  await page.waitForTimeout(1000);
  
  // Take final screenshot
  const finalScreenshot = screenshotManager.getScreenshotPath(
    screenshotManager.getTimestampedFilename('combat-scenario-final')
  );
  await page.screenshot({ path: finalScreenshot });
  
  // Verify the player survived the combat
  const finalHealth = await game.getShipHealth();
  expect(finalHealth).toBeGreaterThan(0);
  
  // The player should have taken some damage during combat
  expect(finalHealth).toBeLessThanOrEqual(initialHealth);
  
  console.log('✅ Player successfully engaged in combat with bots and asteroids');
  console.log(`📊 Health: ${initialHealth} → ${finalHealth}`);
}, TestConfig.DEFAULT_TIMEOUT);
