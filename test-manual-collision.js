// Simple test to manually trigger collision and check respawn
import { chromium } from 'playwright';

async function testManualCollision() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('🌐 Navigating to game...');
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');

    console.log('🎮 Clicking enter game button...');
    await page.click('button:has-text("Enter Game")');
    await page.waitForTimeout(2000);

    console.log('🎯 Game should be loaded, checking for canvas...');
    const canvas = await page.locator('canvas').first();
    await canvas.waitFor({ state: 'visible' });
    console.log('✅ Canvas found');

    // Wait for game to initialize
    await page.waitForTimeout(3000);

    console.log('🚀 Moving ship to collide with asteroid...');
    
    // Move ship right to find an asteroid
    for (let i = 0; i < 50; i++) {
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(50);
    }

    // Move ship up to find an asteroid
    for (let i = 0; i < 50; i++) {
      await page.keyboard.press('ArrowUp');
      await page.waitForTimeout(50);
    }

    // Move ship left to find an asteroid
    for (let i = 0; i < 50; i++) {
      await page.keyboard.press('ArrowLeft');
      await page.waitForTimeout(50);
    }

    // Move ship down to find an asteroid
    for (let i = 0; i < 50; i++) {
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(50);
    }

    console.log('⏳ Waiting for collision or respawn...');
    await page.waitForTimeout(5000);

    // Check if health bar shows 0
    const healthBar = await page.locator('[data-testid="health-bar"]');
    if (await healthBar.isVisible()) {
      const healthText = await healthBar.textContent();
      console.log('🏥 Health bar text:', healthText);
    }

    // Take screenshot
    await page.screenshot({ path: 'manual-collision-test.png' });
    console.log('📸 Screenshot saved as manual-collision-test.png');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await browser.close();
  }
}

testManualCollision().catch(console.error);
