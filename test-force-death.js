// Test to force player death and test respawn
import { chromium } from 'playwright';

async function testForceDeath() {
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

    console.log('🚀 Moving ship to find asteroids and take damage...');
    
    // Move ship in a pattern to find asteroids and take multiple hits
    const movements = [
      { key: 'ArrowRight', duration: 3000 },
      { key: 'ArrowUp', duration: 3000 },
      { key: 'ArrowLeft', duration: 3000 },
      { key: 'ArrowDown', duration: 3000 },
      { key: 'ArrowRight', duration: 3000 },
      { key: 'ArrowUp', duration: 3000 },
      { key: 'ArrowLeft', duration: 3000 },
      { key: 'ArrowDown', duration: 3000 },
    ];

    for (const movement of movements) {
      console.log(`Moving ${movement.key} for ${movement.duration}ms...`);
      const startTime = Date.now();
      while (Date.now() - startTime < movement.duration) {
        await page.keyboard.press(movement.key);
        await page.waitForTimeout(50);
      }
    }

    console.log('⏳ Waiting to see if player dies and respawns...');
    await page.waitForTimeout(5000);

    // Take screenshot
    await page.screenshot({ path: 'force-death-test-result.png' });
    console.log('📸 Screenshot saved as force-death-test-result.png');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await browser.close();
  }
}

testForceDeath().catch(console.error);
