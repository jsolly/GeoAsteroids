// Test to manually trigger respawn mechanism
import { chromium } from 'playwright';

async function testManualRespawn() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('🌐 Navigating to game...');
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');

    console.log('🎮 Clicking enter game button...');
    await page.click('button:has-text("Enter Game")');
    await page.waitForTimeout(3000);

    console.log('🎯 Game should be loaded, checking for canvas...');
    const canvas = await page.locator('canvas').first();
    await canvas.waitFor({ state: 'visible' });
    console.log('✅ Canvas found');

    // Wait for game to initialize
    await page.waitForTimeout(2000);

    console.log('🔧 Manually triggering respawn via console...');
    
    // Execute JavaScript to manually trigger respawn
    const result = await page.evaluate(() => {
      // Check what's available on the window object
      console.log('Available window properties:', Object.keys(window).filter(k => k.includes('game') || k.includes('Game')));
      
      // Get the game controller and local player
      const gameController = window.gameController;
      if (gameController) {
        console.log('Game controller found');
        const localPlayer = gameController.getCurrPlayer();
        if (localPlayer) {
          console.log('Local player found, current health:', localPlayer.ship.health);
          
          // Set health to 0 to simulate death
          localPlayer.ship.health = 0;
          localPlayer.ship.exploding = true;
          localPlayer.ship.explodeTime = 18;
          
          console.log('Set health to 0, exploding to true');
          
          // Check if respawn method exists
          if (typeof localPlayer.respawn === 'function') {
            console.log('Respawn method exists, calling it...');
            localPlayer.respawn();
            console.log('Respawn completed, new health:', localPlayer.ship.health);
            return { success: true, newHealth: localPlayer.ship.health };
          } else {
            console.log('Respawn method does not exist');
            return { success: false, error: 'Respawn method not found' };
          }
        } else {
          console.log('No local player found');
          return { success: false, error: 'No local player' };
        }
      } else {
        console.log('No game controller found');
        return { success: false, error: 'No game controller' };
      }
    });
    
    console.log('Respawn test result:', result);

    console.log('⏳ Waiting to see respawn result...');
    await page.waitForTimeout(3000);

    // Take screenshot
    await page.screenshot({ path: 'manual-respawn-test-result.png' });
    console.log('📸 Screenshot saved as manual-respawn-test-result.png');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await browser.close();
  }
}

testManualRespawn().catch(console.error);
