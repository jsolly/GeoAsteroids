import { Page } from 'playwright';

export class GameInteractions {
  constructor(private page: Page) {}

  /**
   * Navigate to the game
   */
  async navigateToGame(): Promise<void> {
    console.log('🌐 Navigating to game...');
    
    // Add console error logging
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('🚨 Browser console error during navigation:', msg.text());
      }
    });

    // Add page error logging
    this.page.on('pageerror', error => {
      console.log('🚨 Page error during navigation:', error.message);
    });

    try {
      await this.page.goto('http://localhost:5173', { 
        waitUntil: 'load',
        timeout: 30000 
      });
    console.log('✅ Navigated to game');
    } catch (error) {
      console.log('❌ Navigation failed:', error);
      throw error;
    }
  }

  /**
   * Wait for and click the start game button
   */
  async startGame(): Promise<void> {
    // Check for console errors first
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('🚨 Browser console error:', msg.text());
      }
    });

    // Wait for the start screen to load and be visible
    await this.page.waitForSelector('#start-screen', { timeout: 5000 });
    
    // Check if start screen is visible with more detailed logging
    await this.page.waitForFunction(() => {
      const startScreen = document.querySelector('#start-screen');
      if (!startScreen) {
        console.log('🔍 Start screen element not found');
        return false;
      }
      
      const computedStyle = window.getComputedStyle(startScreen);
      const rect = (startScreen as HTMLElement).getBoundingClientRect();
      
      // Check visibility using multiple methods
      const isVisible = computedStyle.display !== 'none' && 
                       computedStyle.visibility !== 'hidden' && 
                       computedStyle.opacity !== '0' &&
                       rect.width > 0 && 
                       rect.height > 0;
      
      console.log('🔍 Start screen visibility check:', {
        element: !!startScreen,
        display: computedStyle.display,
        visibility: computedStyle.visibility,
        opacity: computedStyle.opacity,
        rect: { width: rect.width, height: rect.height },
        isVisible
      });
      
      return isVisible;
    }, { timeout: 10000 });
    console.log('✅ Start screen loaded');

    // Find and click the play button
    const playButton = await this.page.locator('#start-game');
    await this.page.waitForFunction(() => {
      const button = document.querySelector('#start-game');
      if (!button) return false;
      
      const computedStyle = window.getComputedStyle(button);
      const rect = (button as HTMLElement).getBoundingClientRect();
      
      return computedStyle.display !== 'none' && 
             computedStyle.visibility !== 'hidden' && 
             computedStyle.opacity !== '0' &&
             rect.width > 0 && 
             rect.height > 0;
    });
    console.log('🎮 Clicking play button...');
    await playButton.click();
    console.log('✅ Play button clicked');

    // Wait for game area to appear and be visible
    await this.page.waitForSelector('#gameArea', { timeout: 5000 });
    await this.page.waitForFunction(() => {
      const gameArea = document.querySelector('#gameArea');
      if (!gameArea) return false;
      
      const computedStyle = window.getComputedStyle(gameArea);
      const rect = (gameArea as HTMLElement).getBoundingClientRect();
      
      return computedStyle.display !== 'none' && 
             computedStyle.visibility !== 'hidden' && 
             computedStyle.opacity !== '0' &&
             rect.width > 0 && 
             rect.height > 0;
    }, { timeout: 5000 });
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
      if (!canvas) return false;
      
      const computedStyle = window.getComputedStyle(canvas);
      const rect = (canvas as HTMLElement).getBoundingClientRect();
      
      return computedStyle.display !== 'none' && 
             computedStyle.visibility !== 'hidden' && 
             computedStyle.opacity !== '0' &&
             rect.width > 0 && 
             rect.height > 0;
    });
    console.log('✅ Game canvas visible');
  }

  /**
   * Fire lasers multiple times using space key (legacy method)
   */
  async fireLasers(count: number, delayMs: number = 500): Promise<void> {
    console.log(`🔫 Firing ${count} times with space key...`);
    for (let i = 1; i <= count; i++) {
      console.log(`  Firing ${i}/${count}...`);
      await this.page.keyboard.press(' ');
      if (i < count) {
        await this.page.waitForTimeout(delayMs);
      }
    }
  }

  /**
   * Fire lasers multiple times using mouse clicks (left mouse button)
   */
  async fireLasersWithMouse(count: number, delayMs: number = 500): Promise<void> {
    console.log(`🔫 Firing ${count} times with mouse clicks...`);
    
    // Get the canvas element
    const canvas = await this.page.locator('canvas').first();
    await canvas.waitFor({ state: 'visible' });
    
    // Get canvas bounding box
    const boundingBox = await canvas.boundingBox();
    if (!boundingBox) {
      throw new Error('Canvas bounding box not found');
    }
    
    // Click in the center of the canvas for each laser shot
    const centerX = boundingBox.x + boundingBox.width / 2;
    const centerY = boundingBox.y + boundingBox.height / 2;
    
    for (let i = 1; i <= count; i++) {
      console.log(`  Mouse firing ${i}/${count}...`);
      await this.page.mouse.click(centerX, centerY, { button: 'left' });
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
      if (!gameArea) return false;
      
      const computedStyle = window.getComputedStyle(gameArea);
      const rect = (gameArea as HTMLElement).getBoundingClientRect();
      
      return computedStyle.display !== 'none' && 
             computedStyle.visibility !== 'hidden' && 
             computedStyle.opacity !== '0' &&
             rect.width > 0 && 
             rect.height > 0;
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

  /**
   * Wait for the game to load completely
   */
  async waitForGameToLoad(): Promise<void> {
    await this.navigateToGame();
    await this.startGame();
    await this.waitForGameInitialization();
    await this.verifyGameCanvas();
    await this.verifyGameArea();
  }

  /**
   * Wait for game to be ready (running state)
   */
  async waitForGameReady(): Promise<void> {
    await this.page.waitForFunction(
      () => {
        const gameController = (window as any).gameController;
        return gameController?.gameStateManager?.getIsGameRunning?.() === true;
      },
      { timeout: 10000 }
    );
    console.log('✅ Game ready');
  }

  /**
   * Enable debug settings for testing
   */
  async enableDebugSettings(settings: Record<string, any>): Promise<void> {
    await this.page.evaluate((settings) => {
      const gameController = (window as any).gameController;
      if (gameController?.debugManager) {
        // Apply debug settings to the game controller
        Object.assign(gameController.debugManager, settings);
        console.log('🔧 Debug settings applied:', settings);
      } else {
        console.log('🔧 Debug settings enabled (no debug manager):', settings);
      }
    }, settings);
  }

  /**
   * Wait for a specific number of asteroids to be created
   */
  async waitForAsteroids(count: number, timeoutMs: number = 10000): Promise<void> {
    await this.page.waitForFunction(
      (expectedCount) => {
        const gameController = (window as any).gameController;
        if (gameController?.getCurrRoidBelt) {
          const roidBelt = gameController.getCurrRoidBelt();
          const actualCount = roidBelt ? roidBelt.getRoids().length : 0;
          console.log(`🔍 Checking asteroids: expected >= ${expectedCount}, actual = ${actualCount}`);
          return actualCount >= expectedCount;
        }
        console.log(`🔍 No game controller or roid belt available`);
        return false;
      },
      count,
      { timeout: timeoutMs }
    );
    console.log(`✅ Waited for ${count} asteroids`);
  }

  /**
   * Get the current asteroid count
   */
  async getAsteroidCount(): Promise<number> {
    return await this.page.evaluate(() => {
      const gameController = (window as any).gameController;
      if (gameController?.getCurrRoidBelt) {
        const roidBelt = gameController.getCurrRoidBelt();
        return roidBelt ? roidBelt.getRoids().length : 0;
      }
      return 0;
    });
  }

  /**
   * Get asteroid sizes
   */
  async getAsteroidSizes(): Promise<number[]> {
    return await this.page.evaluate(() => {
      const gameController = (window as any).gameController;
      if (gameController?.getCurrRoidBelt) {
        const roidBelt = gameController.getCurrRoidBelt();
        return roidBelt ? roidBelt.getRoids().map((roid: any) => roid.r) : [];
      }
      return [];
    });
  }

  /**
   * Move ship to collide with asteroids
   */
  async moveShipToAsteroids(): Promise<void> {
    // Move ship around to increase collision chances
    // Move in a pattern that covers more area
    await this.moveShip('up', 1000);
    await this.moveShip('down', 1000);
    await this.moveShip('left', 1000);
    await this.moveShip('right', 1000);
    await this.moveShip('up', 1000);
    await this.moveShip('down', 1000);
  }

  /**
   * Wait for asteroid splitting to occur
   */
  async waitForAsteroidSplitting(timeoutMs: number = 3000): Promise<void> {
    await this.page.waitForTimeout(timeoutMs);
    console.log('✅ Waited for asteroid splitting');
  }

  /**
   * Wait for asteroid destruction
   */
  async waitForAsteroidDestruction(timeoutMs: number = 2000): Promise<void> {
    await this.page.waitForTimeout(timeoutMs);
    console.log('✅ Waited for asteroid destruction');
  }

  /**
   * Get ship health
   */
  async getShipHealth(): Promise<number> {
    return await this.page.evaluate(() => {
      const gameController = (window as any).gameController;
      if (gameController?.playerManager?.getLocalPlayer) {
        const player = gameController.playerManager.getLocalPlayer();
        return player?.ship?.health || 100;
      }
      return 100;
    });
  }

  /**
   * Get ship position
   */
  async getShipPosition(): Promise<{ x: number; y: number } | null> {
    return await this.page.evaluate(() => {
      const gameController = (window as any).gameController;
      if (gameController?.playerManager?.getLocalPlayer) {
        const player = gameController.playerManager.getLocalPlayer();
        return player?.ship?.position || null;
      }
      return null;
    });
  }

  /**
   * Get asteroid positions
   */
  async getAsteroidPositions(): Promise<Array<{ x: number; y: number; radius: number }>> {
    return await this.page.evaluate(() => {
      const gameController = (window as any).gameController;
      if (gameController?.getCurrRoidBelt) {
        const roidBelt = gameController.getCurrRoidBelt();
        return roidBelt ? roidBelt.getRoids().map((roid: any) => ({
          x: roid.position.x,
          y: roid.position.y,
          radius: roid.radius
        })) : [];
      }
      return [];
    });
  }

  /**
   * Get detailed asteroid information
   */
  async getAsteroidDetails(): Promise<Array<{ x: number; y: number; radius: number; size: number; id: string }>> {
    return await this.page.evaluate(() => {
      const gameController = (window as any).gameController;
      if (gameController?.getCurrRoidBelt) {
        const roidBelt = gameController.getCurrRoidBelt();
        return roidBelt ? roidBelt.getRoids().map((roid: any) => ({
          x: roid.position.x,
          y: roid.position.y,
          radius: roid.radius,
          size: roid.size || roid.radius,
          id: roid.id || 'unknown'
        })) : [];
      }
      return [];
    });
  }

  /**
   * Wait for a specified amount of time
   */
  async waitForTimeout(ms: number): Promise<void> {
    await this.page.waitForTimeout(ms);
  }

  /**
   * Get player score
   */
  async getPlayerScore(): Promise<number> {
    return await this.page.evaluate(() => {
      const gameController = (window as any).gameController;
      if (gameController?.getCurrScore) {
        return gameController.getCurrScore();
      }
      return 0;
    });
  }

  /**
   * Create medium roids for testing
   */
  async createMediumRoids(count: number): Promise<void> {
    console.log(`🔧 Creating ${count} medium roids`);
    // This would need to interact with the game to create roids
  }

  /**
   * Create small roids for testing
   */
  async createSmallRoids(count: number): Promise<void> {
    console.log(`🔧 Creating ${count} small roids`);
    // This would need to interact with the game to create roids
  }

  /**
   * Move ship to a specific position
   */
  async moveShipToPosition(x: number, y: number): Promise<void> {
    console.log(`🚀 Moving ship to position (${x}, ${y})...`);
    
    // Get current ship position
    const currentPos = await this.getShipPosition();
    if (!currentPos) {
      console.log('❌ Could not get current ship position');
      return;
    }
    
    console.log(`🔍 Current ship position: (${currentPos.x}, ${currentPos.y})`);
    
    // Calculate movement needed
    const deltaX = x - currentPos.x;
    const deltaY = y - currentPos.y;
    
    console.log(`🔍 Movement needed: deltaX=${deltaX}, deltaY=${deltaY}`);
    
    // Move in the required direction with more aggressive movement to ensure collision
    if (deltaX > 0) {
      await this.moveShip('right', Math.max(1000, Math.abs(deltaX) / 2)); // Ensure at least 1 second of movement
    } else if (deltaX < 0) {
      await this.moveShip('left', Math.max(1000, Math.abs(deltaX) / 2));
    }
    
    if (deltaY > 0) {
      await this.moveShip('down', Math.max(1000, Math.abs(deltaY) / 2));
    } else if (deltaY < 0) {
      await this.moveShip('up', Math.max(1000, Math.abs(deltaY) / 2));
    }
    
    console.log(`✅ Ship movement to (${x}, ${y}) complete`);
  }

  /**
   * Move ship in a pattern to collide with multiple roids
   */
  async moveShipInPattern(): Promise<void> {
    const movements = ['up', 'right', 'down', 'left'] as const;
    for (const direction of movements) {
      await this.moveShip(direction, 300);
    }
  }

  /**
   * Wait for multiple collisions
   */
  async waitForMultipleCollisions(timeoutMs: number = 5000): Promise<void> {
    await this.page.waitForTimeout(timeoutMs);
    console.log('✅ Waited for multiple collisions');
  }

  /**
   * Wait for asteroid count to change from initial count
   */
  async waitForAsteroidCountChange(initialCount: number, timeoutMs: number = 10000): Promise<void> {
    await this.page.waitForFunction(
      (expectedInitialCount) => {
        const gameController = (window as any).gameController;
        if (gameController?.getCurrRoidBelt) {
          const roidBelt = gameController.getCurrRoidBelt();
          const currentCount = roidBelt ? roidBelt.getRoids().length : 0;
          console.log(`🔍 Waiting for asteroid count change: initial=${expectedInitialCount}, current=${currentCount}`);
          return currentCount !== expectedInitialCount;
        }
        console.log(`🔍 No game controller or roid belt available`);
        return false;
      },
      initialCount,
      { timeout: timeoutMs }
    );
    console.log(`✅ Asteroid count changed from initial count`);
  }

  /**
   * Check if the ship is currently exploding
   */
  async isShipExploding(): Promise<boolean> {
    return await this.page.evaluate(() => {
      const gameController = (window as any).gameController;
      if (gameController?.playerManager?.getLocalPlayer) {
        const player = gameController.playerManager.getLocalPlayer();
        return player?.ship?.exploding || false;
      }
      return false;
    });
  }

  /**
   * Get the current number of lives
   */
  async getLives(): Promise<number> {
    return await this.page.evaluate(() => {
      const gameController = (window as any).gameController;
      if (gameController?.playerManager?.getLocalPlayer) {
        const player = gameController.playerManager.getLocalPlayer();
        return player?.lives || 0;
      }
      return 0;
    });
  }

  /**
   * Wait for spawn protection to end
   */
  async waitForSpawnProtectionToEnd(timeoutMs: number = 10000): Promise<void> {
    await this.page.waitForFunction(
      () => {
        const gameController = (window as any).gameController;
        if (gameController?.playerManager?.getLocalPlayer) {
          const player = gameController.playerManager.getLocalPlayer();
          const ship = player?.ship;
          if (ship) {
            console.log(`🔍 Checking spawn protection: blinkCount=${ship.blinkCount}, spawnProtectionTimer=${ship.spawnProtectionTimer}`);
            return ship.blinkCount <= 0;
          }
        }
        return false;
      },
      { timeout: timeoutMs }
    );
    console.log('✅ Spawn protection ended');
  }

  /**
   * Check if ship has spawn protection
   */
  async hasSpawnProtection(): Promise<boolean> {
    return await this.page.evaluate(() => {
      const gameController = (window as any).gameController;
      if (gameController?.playerManager?.getLocalPlayer) {
        const player = gameController.playerManager.getLocalPlayer();
        const ship = player?.ship;
        return ship ? ship.blinkCount > 0 : false;
      }
      return false;
    });
  }
}
