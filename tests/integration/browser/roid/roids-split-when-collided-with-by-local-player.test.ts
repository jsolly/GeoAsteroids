import { expect, test, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { BrowserManager } from '../../utils/browser-manager';
import { GameInteractions } from '../../utils/game-interactions';
import { ScreenshotManager } from '../../utils/screenshot-manager';
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

test('roids split when collided with by local player', async () => {
  const page = browserManager.getCurrentPage();
  if (!page) throw new Error('Page not available');
  
  const gameInteractions = new GameInteractions(page);

  await gameInteractions.navigateToGame();
  await gameInteractions.waitForGameToLoad();

  // Wait for game to be ready and asteroids to be created
  await gameInteractions.waitForGameReady();
  
  // Check current asteroid count first
  const initialCount = await gameInteractions.getAsteroidCount();
  console.log(`📊 Initial asteroid count: ${initialCount}`);
  
  // Wait for asteroids to be created (normal spawning) - skip since we already have 30
  console.log(`📊 Skipping waitForAsteroids since we already have ${initialCount} asteroids`);

  // Get initial asteroid count
  const initialAsteroidCount = await gameInteractions.getAsteroidCount();
  expect(initialAsteroidCount).toBeGreaterThan(0);

  // Get asteroid position and move ship there
  const asteroidPositions = await gameInteractions.getAsteroidPositions();
  console.log(`🪨 Initial asteroid positions: ${JSON.stringify(asteroidPositions.slice(0, 5))}`);
  
  // Move ship to the first asteroid's position to collide with it
  if (asteroidPositions.length > 0) {
    const targetAsteroid = asteroidPositions[0];
    console.log(`🚀 Moving ship to asteroid at position (${targetAsteroid.x}, ${targetAsteroid.y})...`);
    await gameInteractions.moveShipToPosition(targetAsteroid.x, targetAsteroid.y);
  } else {
    console.log('❌ No asteroids found to collide with');
    throw new Error('No asteroids available for collision test');
  }

  // Check ship position and asteroid positions for debugging
  const shipPosition = await gameInteractions.getShipPosition();
  const finalAsteroidPositions = await gameInteractions.getAsteroidPositions();
  console.log(`🚀 Ship position after movement: ${JSON.stringify(shipPosition)}`);
  console.log(`🪨 Asteroid positions (first 5): ${JSON.stringify(finalAsteroidPositions.slice(0, 5))}`);

  // Check health immediately after collision (before respawn)
  console.log('💔 Checking collision damage...');
  await page.waitForTimeout(500); // Wait a moment for collision to register
  const shipHealth = await gameInteractions.getShipHealth();
  console.log(`💔 Ship health after collision: ${shipHealth}`);
  expect(shipHealth).toBeLessThan(100); // Should have taken damage

  // Wait for collision and splitting to occur
  await gameInteractions.waitForAsteroidSplitting();

  // Wait for asteroid count to change (indicating splitting occurred)
  let finalAsteroidCount = await gameInteractions.getAsteroidCount();
  let attempts = 0;
  const maxAttempts = 10;
  
  while (finalAsteroidCount <= initialAsteroidCount && attempts < maxAttempts) {
    console.log(`⏳ Waiting for asteroid splitting... attempt ${attempts + 1}/${maxAttempts}, current count: ${finalAsteroidCount}, initial: ${initialAsteroidCount}`);
    await page.waitForTimeout(1000); // Wait 1 second
    finalAsteroidCount = await gameInteractions.getAsteroidCount();
    attempts++;
  }

  console.log(`📊 Final asteroid count: ${finalAsteroidCount}, Initial: ${initialAsteroidCount}`);
  expect(finalAsteroidCount).toBeGreaterThan(initialAsteroidCount);
}, TestConfig.DEFAULT_TIMEOUT);
