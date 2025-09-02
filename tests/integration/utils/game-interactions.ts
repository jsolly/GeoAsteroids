import { Page } from 'playwright';

export class GameInteractions {
  constructor(private page: Page) {}

  /**
   * Navigate to the game
   */
  async navigateToGame(): Promise<void> {
    await this.page.goto('http://localhost:5173');
    console.log('✅ Navigated to game');
  }

  /**
   * Wait for and click the start game button
   */
  async startGame(): Promise<void> {
    // Wait for the start screen to load
    await this.page.waitForSelector('#start-screen', { timeout: 5000 });
    console.log('✅ Start screen loaded');

    // Find and click the play button
    const playButton = await this.page.locator('#start-game');
    await this.page.waitForFunction(() => {
      const button = document.querySelector('#start-game');
      return button && (button as HTMLElement).offsetParent !== null; // Check if visible
    });
    console.log('🎮 Clicking play button...');
    await playButton.click();

    // Wait for game area to appear
    await this.page.waitForSelector('#gameArea', { timeout: 5000 });
    console.log('✅ Game area loaded');
  }

  /**
   * Wait for the game to be fully initialized
   */
  async waitForGameInitialization(timeoutMs: number = 2000): Promise<void> {
    await this.page.waitForTimeout(timeoutMs);
    console.log('⏳ Game initialization complete');
  }

  /**
   * Verify the game canvas is visible
   */
  async verifyGameCanvas(): Promise<void> {
    await this.page.waitForFunction(() => {
      const canvas = document.querySelector('canvas');
      return canvas && (canvas as HTMLElement).offsetParent !== null;
    });
    console.log('✅ Game canvas visible');
  }

  /**
   * Fire lasers multiple times
   */
  async fireLasers(count: number, delayMs: number = 500): Promise<void> {
    console.log(`🔫 Firing ${count} times...`);
    for (let i = 1; i <= count; i++) {
      console.log(`  Firing ${i}/${count}...`);
      await this.page.keyboard.press(' ');
      if (i < count) {
        await this.page.waitForTimeout(delayMs);
      }
    }
  }

  /**
   * Move the ship in a specified direction
   */
  async moveShip(direction: 'left' | 'right' | 'up' | 'down', durationMs: number = 1000): Promise<void> {
    const key = direction === 'left' ? 'ArrowLeft' : 
                direction === 'right' ? 'ArrowRight' : 
                direction === 'up' ? 'ArrowUp' : 'ArrowDown';
    
    console.log(`🚀 Moving ship ${direction} for ${durationMs}ms...`);
    await this.page.keyboard.down(key);
    await this.page.waitForTimeout(durationMs);
    await this.page.keyboard.up(key);
    console.log(`✅ Ship movement complete`);
  }

  /**
   * Verify the game area is visible
   */
  async verifyGameArea(): Promise<void> {
    await this.page.waitForFunction(() => {
      const gameArea = document.querySelector('#gameArea');
      return gameArea && (gameArea as HTMLElement).offsetParent !== null;
    });
    console.log('✅ Game area verified');
  }

  /**
   * Get page text content for debugging
   */
  async getPageTextContent(maxLength: number = 500): Promise<string> {
    const pageText = await this.page.textContent('body');
    const truncated = pageText?.substring(0, maxLength) + '...';
    console.log('📄 Page text content:', truncated);
    return pageText || '';
  }

  /**
   * Check for debug information on the page
   */
  async checkForDebugInfo(): Promise<{ found: boolean; details: string[] }> {
    const debugSelectors = [
      'text=Asteroids:',
      'text=DEBUG MODE',
      '[id*="debug"]',
      '[class*="debug"]'
    ];

    const details: string[] = [];
    let found = false;

    for (const selector of debugSelectors) {
      try {
        const element = await this.page.locator(selector).first();
        if (await element.isVisible()) {
          details.push(`✅ Found debug info with selector: ${selector}`);
          found = true;
          break;
        }
      } catch (e) {
        details.push(`❌ Selector failed: ${selector}`);
      }
    }

    if (!found) {
      details.push('⚠️ No debug info found with any selector');
      
      // Check for elements containing specific text
      const elementsWithAsteroid = await this.page.locator('*:has-text("Asteroid")').count();
      details.push(`🔍 Elements containing "Asteroid": ${elementsWithAsteroid}`);
      
      const elementsWithDebug = await this.page.locator('*:has-text("DEBUG")').count();
      details.push(`🔍 Elements containing "DEBUG": ${elementsWithDebug}`);
    }

    return { found, details };
  }
}
