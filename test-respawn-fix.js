// Test to verify respawn fix
import { chromium } from 'playwright';

async function testRespawnFix() {
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

    console.log('🚀 Moving ship to collide with asteroid...');
    
    // Move ship in a pattern to find and collide with asteroids
    const movements = [
      { key: 'ArrowRight', duration: 2000 },
      { key: 'ArrowUp', duration: 2000 },
      { key: 'ArrowLeft', duration: 2000 },
      { key: 'ArrowDown', duration: 2000 },
      { key: 'ArrowRight', duration: 2000 },
      { key: 'ArrowUp', duration: 2000 },
    ];

    for (const movement of movements) {
      console.log(`Moving ${movement.key} for ${movement.duration}ms...`);
      const startTime = Date.now();
      while (Date.now() - startTime < movement.duration) {
        await page.keyboard.press(movement.key);
        await page.waitForTimeout(50);
      }
    }

    console.log('⏳ Waiting to see if respawn happens...');
    await page.waitForTimeout(5000);

    // Take screenshot
    await page.screenshot({ path: 'respawn-test-result.png' });
    console.log('📸 Screenshot saved as respawn-test-result.png');

    // Check logs for respawn messages
    console.log('📋 Checking logs for respawn messages...');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await browser.close();
  }
}

testRespawnFix().catch(console.error);
