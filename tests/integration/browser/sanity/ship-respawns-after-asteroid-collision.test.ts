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
    throw error;
  }
  
  // Clear screenshots and initialize browser
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

test('ship respawns after asteroid collision when spawn protection ends', async () => {
  const page = browserManager.getCurrentPage();
  if (!page) throw new Error('Page not available');
  
  const game = new GameInteractions(page);

  // Navigate to game and start
  await game.navigateToGame();
  await game.startGame();
  await game.waitForGameInitialization(TestConfig.GAME_INIT_TIMEOUT);

  // Get initial ship state
  const initialHealth = await game.getShipHealth();
  expect(initialHealth).toBe(100);

  // Wait for spawn protection to end
  await game.waitForSpawnProtectionToEnd();

  // Force a collision with an asteroid by moving into one
  // First, find an asteroid position
  const asteroidPositions = await game.getAsteroidPositions();
  console.log(`Found ${asteroidPositions.length} asteroids`);
  
  if (asteroidPositions.length > 0) {
    const asteroidPos = asteroidPositions[0];
    console.log(`Moving ship to asteroid at (${asteroidPos.x}, ${asteroidPos.y})`);
    
    // Move ship to asteroid position to force collision
    await game.moveShipToPosition(asteroidPos.x, asteroidPos.y);
    
    // Wait for collision to be processed and server update to be received
    await page.waitForTimeout(5000);
    
    // Check ship health
    const shipHealth = await game.getShipHealth();
    console.log(`Ship health after collision: ${shipHealth}`);
    
    // Check if ship is exploding
    const isExploding = await game.isShipExploding();
    console.log(`Ship exploding: ${isExploding}`);
    expect(isExploding).toBe(true);
    
    // Wait for explosion to finish and respawn
    await page.waitForTimeout(3000);
    
    // Check if ship has respawned with full health
    const respawnedHealth = await game.getShipHealth();
    expect(respawnedHealth).toBe(100);
    
    // Check if ship is no longer exploding
    const stillExploding = await game.isShipExploding();
    expect(stillExploding).toBe(false);
    
    // Check if spawn protection is active after respawn
    const hasSpawnProtection = await game.hasSpawnProtection();
    expect(hasSpawnProtection).toBe(true);
  } else {
    console.log('No asteroids found, skipping collision test');
  }
}, TestConfig.DEFAULT_TIMEOUT);
