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
  console.log('🧹 Cleared screenshots directory');
  
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

test('player explodes when hitting boundary', async () => {
  const page = browserManager.getCurrentPage();
  if (!page) throw new Error('Page not available');
  
  const game = new GameInteractions(page);

  // Navigate to game and start
  await game.navigateToGame();
  await game.startGame();
  await game.waitForGameInitialization(TestConfig.GAME_INIT_TIMEOUT);

  // Get initial ship position
  const initialPosition = await game.getShipPosition();
  console.log('Initial ship position:', initialPosition);

  // Move ship to the boundary by thrusting and turning right
  console.log('Moving ship to boundary...');
  
  // First turn the ship to face right
  await game.moveShip('right', 500); // Turn right
  
  // Then thrust forward for a long time to reach the boundary
  await game.moveShip('up', 8000); // Thrust forward for 8 seconds
  
  // Check if ship is still alive (should be dead if boundary collision works)
  const finalPosition = await game.getShipPosition();
  console.log('Final ship position:', finalPosition);
  
  // Check if ship is exploding or has died
  const isExploding = await game.isShipExploding();
  const lives = await game.getLives();
  
  console.log('Ship exploding:', isExploding);
  console.log('Lives remaining:', lives);
  
  // The ship should have hit the boundary and exploded
  expect(isExploding || lives < 3).toBe(true);
}, TestConfig.DEFAULT_TIMEOUT);
