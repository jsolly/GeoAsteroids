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

// Test: Laser network communication between two clients
test('laser communication works between multiple clients', async () => {
  // Create two browser pages to simulate two clients
  const page1 = browserManager.getCurrentPage();
  if (!page1) throw new Error('Page 1 not available');
  
  // Create a second page for the second client
  await browserManager.createPage();
  const page2 = browserManager.getCurrentPage();
  if (!page2) throw new Error('Page 2 not available');
  
  const game1 = new GameInteractions(page1);
  const game2 = new GameInteractions(page2);
  
  // Set up console message listeners for both pages
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
  
  // Start both games
  console.log('🎮 Starting game for client 1...');
  await game1.navigateToGame();
  await game1.startGame();
  await game1.waitForGameInitialization(TestConfig.GAME_INIT_TIMEOUT);
  
  console.log('🎮 Starting game for client 2...');
  await game2.navigateToGame();
  await game2.startGame();
  await game2.waitForGameInitialization(TestConfig.GAME_INIT_TIMEOUT);
  
  // Wait for both clients to connect to each other
  await page1.waitForTimeout(3000);
  await page2.waitForTimeout(3000);
  
  // Client 1 fires lasers
  console.log('🔫 Client 1 firing lasers...');
  await game1.fireLasersWithMouse(2, 1000);
  
  // Wait for network communication
  await page1.waitForTimeout(2000);
  await page2.waitForTimeout(2000);
  
  // Take screenshots for both clients
  const screenshot1Path = screenshotManager.getScreenshotPath(
    screenshotManager.getTimestampedFilename('client1-laser-communication-test')
  );
  await page1.screenshot({ path: screenshot1Path });
  
  const screenshot2Path = screenshotManager.getScreenshotPath(
    screenshotManager.getTimestampedFilename('client2-laser-communication-test')
  );
  await page2.screenshot({ path: screenshot2Path });
  
  // Check network messages
  console.log('📝 Client 1 messages:', page1Messages);
  console.log('📝 Client 2 messages:', page2Messages);
  
  // Verify that client 1 sent shoot messages
  const client1ShootMessages = page1Messages.filter(msg => 
    msg.includes('Sending shoot message to server') ||
    msg.includes('Sending shoot event')
  );
  
  // Verify that client 2 received shoot messages
  const client2ReceiveMessages = page2Messages.filter(msg => 
    msg.includes('Client received playerShoot message') ||
    msg.includes('Added laser to remote player')
  );
  
  expect(client1ShootMessages.length).toBeGreaterThan(0);
  expect(client2ReceiveMessages.length).toBeGreaterThan(0);
  
  console.log('✅ Laser communication between clients is working');
}, TestConfig.DEFAULT_TIMEOUT * 2);
