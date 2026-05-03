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

// Test: Complete laser network flow from client to client
test('complete laser network flow works end-to-end', async () => {
  // Create two browser pages to simulate two clients
  const page1 = browserManager.getCurrentPage();
  if (!page1) throw new Error('Page 1 not available');
  
  // Create a second page for the second client
  await browserManager.createPage();
  const page2 = browserManager.getCurrentPage();
  if (!page2) throw new Error('Page 2 not available');
  
  const game1 = new GameInteractions(page1);
  const game2 = new GameInteractions(page2);
  
  // Set up comprehensive message tracking
  const page1Messages: { type: string; message: string; timestamp: number }[] = [];
  const page2Messages: { type: string; message: string; timestamp: number }[] = [];
  
  // Track all relevant messages from both pages
  page1.on('console', (msg) => {
    const text = msg.text();
    const timestamp = Date.now();
    
    if (text.includes('MOUSE') || text.includes('SHIP') || text.includes('NETWORK') || 
        text.includes('shoot') || text.includes('laser') || text.includes('GAME_CONTROLLER')) {
      page1Messages.push({ type: msg.type(), message: text, timestamp });
    }
  });
  
  page2.on('console', (msg) => {
    const text = msg.text();
    const timestamp = Date.now();
    
    if (text.includes('MOUSE') || text.includes('SHIP') || text.includes('NETWORK') || 
        text.includes('shoot') || text.includes('laser') || text.includes('GAME_CONTROLLER')) {
      page2Messages.push({ type: msg.type(), message: text, timestamp });
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
  
  // Wait for both clients to connect and see each other
  console.log('⏳ Waiting for clients to connect...');
  await page1.waitForTimeout(5000);
  await page2.waitForTimeout(5000);
  
  // Take initial screenshots
  const initialScreenshot1 = screenshotManager.getScreenshotPath(
    screenshotManager.getTimestampedFilename('client1-initial-state')
  );
  await page1.screenshot({ path: initialScreenshot1 });
  
  const initialScreenshot2 = screenshotManager.getScreenshotPath(
    screenshotManager.getTimestampedFilename('client2-initial-state')
  );
  await page2.screenshot({ path: initialScreenshot2 });
  
  // Client 1 fires lasers
  console.log('🔫 Client 1 firing lasers...');
  await game1.fireLasersWithMouse(3, 1000);
  
  // Wait for network processing and rendering
  console.log('⏳ Waiting for network processing...');
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
  
  // Analyze the message flow
  console.log('📝 Client 1 messages:', page1Messages);
  console.log('📝 Client 2 messages:', page2Messages);
  
  // Verify the complete flow
  const client1ShootMessages = page1Messages.filter(msg => 
    msg.message.includes('Left mouse click - shooting') ||
    msg.message.includes('Shoot method called') ||
    msg.message.includes('Sending shoot event') ||
    msg.message.includes('Sending shoot message to server')
  );
  
  const client2ReceiveMessages = page2Messages.filter(msg => 
    msg.message.includes('Client received playerShoot message') ||
    msg.message.includes('Added laser to remote player') ||
    msg.message.includes('Player shot laser')
  );
  
  // Check for game initialization messages
  const client1InitMessages = page1Messages.filter(msg => 
    msg.message.includes('startGame called') ||
    msg.message.includes('Initializing input listeners')
  );
  
  const client2InitMessages = page2Messages.filter(msg => 
    msg.message.includes('startGame called') ||
    msg.message.includes('Initializing input listeners')
  );
  
  // Verify that both clients initialized properly
  expect(client1InitMessages.length).toBeGreaterThan(0);
  expect(client2InitMessages.length).toBeGreaterThan(0);
  console.log('✅ Both clients initialized properly');
  
  // Verify that client 1 sent shoot messages
  expect(client1ShootMessages.length).toBeGreaterThan(0);
  console.log('✅ Client 1 sent shoot messages');
  
  // Verify that client 2 received shoot messages
  expect(client2ReceiveMessages.length).toBeGreaterThan(0);
  console.log('✅ Client 2 received shoot messages');
  
  // Log the complete message flow for debugging
  console.log('🔄 Complete message flow:');
  console.log('Client 1 shoot messages:', client1ShootMessages.map(m => m.message));
  console.log('Client 2 receive messages:', client2ReceiveMessages.map(m => m.message));
  
  console.log('✅ Complete laser network flow is working end-to-end');
}, TestConfig.DEFAULT_TIMEOUT * 3);
