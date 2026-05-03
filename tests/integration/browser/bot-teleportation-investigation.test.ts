import { test, beforeAll, afterAll, beforeEach, afterEach, expect } from 'vitest';
import { BrowserManager } from '../utils/browser-manager';
import { ScreenshotManager } from '../utils/screenshot-manager';
import { GameInteractions } from '../utils/game-interactions';
import { TestConfig } from '../utils/test-config';
import { HealthChecker } from '../utils/health-checker';

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

// Bot position tracking interface
interface BotPosition {
  id: string;
  x: number;
  y: number;
  health: number;
  exploding: boolean;
  timestamp: number;
}

// Test to investigate bot teleportation behavior
test('investigate bot teleportation and reappearing behavior', async () => {
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
  
  // Wait for game to be fully loaded and bots to be created
  await game.waitForGameReady();
  await page.waitForTimeout(2000); // Additional wait for bots to spawn
  
  console.log('🤖 Starting bot teleportation investigation...');
  
  // Function to get bot positions from the game
  const getBotPositions = async (): Promise<BotPosition[]> => {
    return await page.evaluate(() => {
      const gameController = (window as any).gameController;
      if (gameController?.playerManager?.getRemotePlayers) {
        const remotePlayers = gameController.playerManager.getRemotePlayers();
        return remotePlayers.map((bot: any) => ({
          id: bot.id,
          x: bot.ship?.position?.x || 0,
          y: bot.ship?.position?.y || 0,
          health: bot.ship?.health || 0,
          exploding: bot.ship?.exploding || false,
          timestamp: Date.now()
        }));
      }
      return [];
    });
  };
  
  // Function to get game state info for debugging
  const getGameStateInfo = async () => {
    return await page.evaluate(() => {
      const gameController = (window as any).gameController;
      return {
        isGameRunning: gameController?.gameStateManager?.getIsGameRunning?.(),
        playerCount: gameController?.playerManager?.getPlayerCount?.(),
        remotePlayerCount: gameController?.playerManager?.getRemotePlayers?.()?.length || 0,
        gameTime: gameController?.gameTime || 0,
        frameCount: gameController?.frameCount || 0
      };
    });
  };
  
  // Initial game state
  const initialState = await getGameStateInfo();
  console.log('🎮 Initial game state:', initialState);
  
  // Get initial bot positions
  let botPositions = await getBotPositions();
  console.log(`🤖 Initial bot count: ${botPositions.length}`);
  botPositions.forEach((bot, index) => {
    console.log(`  Bot ${index + 1}: ID=${bot.id}, pos=(${bot.x.toFixed(1)}, ${bot.y.toFixed(1)}), health=${bot.health}, exploding=${bot.exploding}`);
  });
  
  // Take initial screenshot
  const initialScreenshot = screenshotManager.getScreenshotPath(
    screenshotManager.getTimestampedFilename('bot-teleportation-initial')
  );
  await page.screenshot({ path: initialScreenshot });
  
  // Track bot positions over time (15 seconds)
  const trackingDuration = 15000; // 15 seconds
  const trackingInterval = 1000; // Check every 1 second
  const totalChecks = trackingDuration / trackingInterval;
  
  const positionHistory: BotPosition[][] = [];
  const teleportationEvents: Array<{
    botId: string;
    from: { x: number; y: number };
    to: { x: number; y: number };
    timestamp: number;
    timeDiff: number;
  }> = [];
  
  console.log(`📊 Tracking bot positions for ${trackingDuration/1000} seconds...`);
  
  for (let check = 0; check < totalChecks; check++) {
    const currentPositions = await getBotPositions();
    const gameState = await getGameStateInfo();
    
    console.log(`\n⏰ Check ${check + 1}/${totalChecks} (${(check + 1) * trackingInterval/1000}s)`);
    console.log(`🤖 Bot count: ${currentPositions.length}`);
    console.log(`🎮 Game running: ${gameState.isGameRunning}, Frame: ${gameState.frameCount}`);
    
    // Log each bot's current state
    currentPositions.forEach((bot, index) => {
      console.log(`  Bot ${index + 1}: ID=${bot.id}, pos=(${bot.x.toFixed(1)}, ${bot.y.toFixed(1)}), health=${bot.health}, exploding=${bot.exploding}`);
    });
    
    // Check for teleportation events
    if (positionHistory.length > 0) {
      const previousPositions = positionHistory[positionHistory.length - 1];
      
      for (const currentBot of currentPositions) {
        const previousBot = previousPositions.find(p => p.id === currentBot.id);
        
        if (previousBot) {
          // Calculate distance moved
          const dx = currentBot.x - previousBot.x;
          const dy = currentBot.y - previousBot.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          // If bot moved more than 100 pixels in 1 second, it's likely a teleportation
          if (distance > 100) {
            const teleportEvent = {
              botId: currentBot.id,
              from: { x: previousBot.x, y: previousBot.y },
              to: { x: currentBot.x, y: currentBot.y },
              timestamp: currentBot.timestamp,
              timeDiff: currentBot.timestamp - previousBot.timestamp
            };
            
            teleportationEvents.push(teleportEvent);
            console.log(`🚨 TELEPORTATION DETECTED! Bot ${currentBot.id}:`);
            console.log(`    From: (${previousBot.x.toFixed(1)}, ${previousBot.y.toFixed(1)})`);
            console.log(`    To: (${currentBot.x.toFixed(1)}, ${currentBot.y.toFixed(1)})`);
            console.log(`    Distance: ${distance.toFixed(1)}px in ${teleportEvent.timeDiff}ms`);
            console.log(`    Health: ${previousBot.health} → ${currentBot.health}`);
            console.log(`    Exploding: ${previousBot.exploding} → ${currentBot.exploding}`);
          }
        }
      }
      
      // Check for bots that disappeared
      for (const previousBot of previousPositions) {
        const currentBot = currentPositions.find(p => p.id === previousBot.id);
        if (!currentBot) {
          console.log(`👻 Bot ${previousBot.id} DISAPPEARED!`);
        }
      }
      
      // Check for new bots that appeared
      for (const currentBot of currentPositions) {
        const previousBot = previousPositions.find(p => p.id === currentBot.id);
        if (!previousBot) {
          console.log(`✨ New bot ${currentBot.id} APPEARED at (${currentBot.x.toFixed(1)}, ${currentBot.y.toFixed(1)})!`);
        }
      }
    }
    
    positionHistory.push(currentPositions);
    
    // Wait before next check
    if (check < totalChecks - 1) {
      await page.waitForTimeout(trackingInterval);
    }
  }
  
  // Take final screenshot
  const finalScreenshot = screenshotManager.getScreenshotPath(
    screenshotManager.getTimestampedFilename('bot-teleportation-final')
  );
  await page.screenshot({ path: finalScreenshot });
  
  // Final game state
  const finalState = await getGameStateInfo();
  console.log('\n🎮 Final game state:', finalState);
  
  // Analysis and reporting
  console.log('\n📊 INVESTIGATION RESULTS:');
  console.log(`🔍 Total tracking time: ${trackingDuration/1000} seconds`);
  console.log(`📈 Position checks: ${positionHistory.length}`);
  console.log(`🚨 Teleportation events detected: ${teleportationEvents.length}`);
  
  if (teleportationEvents.length > 0) {
    console.log('\n🚨 TELEPORTATION EVENTS:');
    teleportationEvents.forEach((event, index) => {
      console.log(`  Event ${index + 1}:`);
      console.log(`    Bot ID: ${event.botId}`);
      console.log(`    From: (${event.from.x.toFixed(1)}, ${event.from.y.toFixed(1)})`);
      console.log(`    To: (${event.to.x.toFixed(1)}, ${event.to.y.toFixed(1)})`);
      console.log(`    Time: ${new Date(event.timestamp).toLocaleTimeString()}`);
      console.log(`    Time diff: ${event.timeDiff}ms`);
    });
    
    // Calculate average teleportation distance
    const avgDistance = teleportationEvents.reduce((sum, event) => {
      const dx = event.to.x - event.from.x;
      const dy = event.to.y - event.from.y;
      return sum + Math.sqrt(dx * dx + dy * dy);
    }, 0) / teleportationEvents.length;
    
    console.log(`📏 Average teleportation distance: ${avgDistance.toFixed(1)}px`);
  } else {
    console.log('✅ No teleportation events detected during tracking period');
  }
  
  // Check for bot count changes
  const initialBotCount = positionHistory[0]?.length || 0;
  const finalBotCount = positionHistory[positionHistory.length - 1]?.length || 0;
  const maxBotCount = Math.max(...positionHistory.map(positions => positions.length));
  const minBotCount = Math.min(...positionHistory.map(positions => positions.length));
  
  console.log('\n🤖 BOT COUNT ANALYSIS:');
  console.log(`  Initial count: ${initialBotCount}`);
  console.log(`  Final count: ${finalBotCount}`);
  console.log(`  Max count: ${maxBotCount}`);
  console.log(`  Min count: ${minBotCount}`);
  console.log(`  Count variation: ${maxBotCount - minBotCount}`);
  
  if (maxBotCount !== minBotCount) {
    console.log('⚠️ Bot count varied during tracking - this suggests respawning behavior');
  }
  
  // Log detailed position history for analysis
  console.log('\n📋 DETAILED POSITION HISTORY:');
  positionHistory.forEach((positions, index) => {
    console.log(`  Check ${index + 1}:`);
    positions.forEach((bot, botIndex) => {
      console.log(`    Bot ${botIndex + 1}: ID=${bot.id}, pos=(${bot.x.toFixed(1)}, ${bot.y.toFixed(1)}), health=${bot.health}, exploding=${bot.exploding}`);
    });
  });
  
  // The test should pass regardless of findings - we're investigating, not asserting
  expect(true).toBe(true);
  
  console.log('\n✅ Bot teleportation investigation completed');
  console.log('📁 Screenshots saved for visual analysis');
  console.log('📊 Check the console output above for detailed teleportation analysis');
}, TestConfig.DEFAULT_TIMEOUT * 2); // Double timeout for this investigation
