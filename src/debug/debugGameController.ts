import { GameController } from '../core/gameController';
import { Asteroid, type AsteroidBelt } from '../entities/asteroid/Asteroid';
import { getDebugConfig } from './debugConfig';
import { DebugMultiplayerManager } from './debugMultiplayerManager';

// Interface for asteroid belt with debug config
interface AsteroidBeltWithDebug extends AsteroidBelt {
  debugConfig?: ReturnType<typeof getDebugConfig>;
}

export class DebugGameController {
  private gameController: GameController;
  private debugMultiplayerManager: DebugMultiplayerManager;
  private debugMode = false;
  private debugConfig = getDebugConfig();
  private asteroidInitializationTimer?: number;
  private asteroidInjectionTimer?: number;
  private asteroidBeltReady = false;

  constructor() {
    this.gameController = GameController.getInstance();
    this.debugMultiplayerManager = new DebugMultiplayerManager();
  }

  public enableDebugMode(): void {
    this.debugMode = true;

    // Cancel any previous timers
    if (this.asteroidInitializationTimer) {
      clearTimeout(this.asteroidInitializationTimer);
      this.asteroidInitializationTimer = undefined;
    }
    if (this.asteroidInjectionTimer) {
      clearTimeout(this.asteroidInjectionTimer);
      this.asteroidInjectionTimer = undefined;
    }

    // Reset ready state
    this.asteroidBeltReady = false;

    // Inject debug functionality into the existing asteroid belt
    this.injectDebugAsteroidFunctionality();

    // Wait for asteroid belt to be ready, then perform all asteroid operations atomically
    this.waitForAsteroidBeltAndInitialize();

    // Enable multiplayer mode in game state but don't create bots yet
    this.gameController.getGameState().setMultiplayerEnabled(true);

    // Clear any existing bots first
    this.debugMultiplayerManager.disableBots();

    // Create bots based on configuration
    const botCount = this.debugConfig.botCount;
    this.debugMultiplayerManager.enableBots(botCount);

    // Configure bot behavior based on settings
    if (this.debugConfig.disableBotMovement) {
      this.debugMultiplayerManager.disableBotMovement();
    }

    console.info('DEBUG_MODE', 'Debug mode enabled with configuration', this.debugConfig);
    console.info('DEBUG_CONFIG_VALUES', {
      drawAsteroids: this.debugConfig.drawAsteroids,
      debugAsteroidCount: this.debugConfig.debugAsteroidCount,
      placeAsteroidOnBot: this.debugConfig.placeAsteroidOnBot,
      botCount: this.debugConfig.botCount,
      disableAsteroidMultiplication: this.debugConfig.disableAsteroidMultiplication,
      disableAsteroidMovement: this.debugConfig.disableAsteroidMovement,
    });
  }

  private waitForAsteroidBeltAndInitialize(): void {
    // Check if asteroid belt is ready (has been created and initialized)
    const checkAsteroidBeltReady = (): boolean => {
      try {
        const asteroidBelt = this.gameController.getCurrRoidBelt();
        // Check if the belt exists and has the expected structure
        return (
          asteroidBelt &&
          typeof asteroidBelt.roids === 'object' &&
          Array.isArray(asteroidBelt.roids) &&
          typeof asteroidBelt.addRoid === 'function'
        );
      } catch {
        return false;
      }
    };

    // If already ready, initialize immediately
    if (checkAsteroidBeltReady()) {
      this.asteroidBeltReady = true;
      this.performAsteroidInitialization();
      return;
    }

    // Otherwise, poll until ready with a reasonable timeout
    const maxWaitTime = 5000; // 5 seconds max wait
    const pollInterval = 50; // Check every 50ms
    let elapsedTime = 0;

    const pollForReady = () => {
      if (checkAsteroidBeltReady()) {
        this.asteroidBeltReady = true;
        this.performAsteroidInitialization();
        return;
      }

      elapsedTime += pollInterval;
      if (elapsedTime >= maxWaitTime) {
        console.warn('DEBUG_ASTEROIDS', 'Timeout waiting for asteroid belt to be ready');
        return;
      }

      this.asteroidInitializationTimer = window.setTimeout(pollForReady, pollInterval);
    };

    this.asteroidInitializationTimer = window.setTimeout(pollForReady, pollInterval);
  }

  private performAsteroidInitialization(): void {
    // Guard against multiple calls
    if (!this.asteroidBeltReady) {
      return;
    }

    try {
      const asteroidBelt = this.gameController.getCurrRoidBelt();

      // Store the current belt instance to ensure we're working with the same one
      const beltInstance = asteroidBelt;

      // Perform all asteroid operations atomically
      this.coordinateAsteroidOperations(beltInstance);

      console.info('DEBUG_ASTEROIDS', 'Asteroid initialization completed successfully');
    } catch (error) {
      console.error('DEBUG_ASTEROIDS', 'Error during asteroid initialization', error);
    }
  }

  private coordinateAsteroidOperations(asteroidBelt: AsteroidBelt): void {
    // Verify we're still working with the same belt instance
    if (asteroidBelt !== this.gameController.getCurrRoidBelt()) {
      console.warn(
        'DEBUG_ASTEROIDS',
        'Asteroid belt instance changed during initialization, aborting'
      );
      return;
    }

    // Step 1: Override asteroid count for debug mode
    if (this.debugConfig.drawAsteroids) {
      // Clear existing asteroids and add the debug amount
      asteroidBelt.roids = [];

      // Add the debug asteroid count from config
      for (let i = 0; i < this.debugConfig.debugAsteroidCount; i++) {
        asteroidBelt.addRoid();
      }

      console.info(
        'DEBUG_ASTEROIDS',
        `Overrode asteroid count to ${this.debugConfig.debugAsteroidCount} for debug mode`
      );
    } else {
      // Clear all base asteroids when drawing is disabled
      asteroidBelt.roids = [];
      console.info(
        'DEBUG_ASTEROIDS',
        'Cleared all base asteroids because VITE_DEBUG_DRAW_ASTEROIDS is false'
      );
    }

    // Step 2: Place asteroids on bots if configured
    if (this.debugConfig.placeAsteroidOnBot) {
      this.placeAsteroidsOnBots(asteroidBelt);
    }

    // Step 3: Add extra asteroids for debug mode
    if (this.debugConfig.drawAsteroids) {
      this.addExtraAsteroidsForDebug(asteroidBelt);
    }
  }

  private placeAsteroidsOnBots(asteroidBelt: AsteroidBelt): void {
    // Verify belt instance is still valid
    if (asteroidBelt !== this.gameController.getCurrRoidBelt()) {
      return;
    }

    const bots = this.debugMultiplayerManager.getBots();
    if (bots.size > 0) {
      bots.forEach((bot, _botId) => {
        // Guard against bots without valid position
        if (bot && bot.ship && bot.ship.position) {
          const botPosition = bot.ship.position;
          // Create an asteroid at the bot's position for collision testing
          // This works independently of VITE_DEBUG_DRAW_ASTEROIDS
          const asteroid = new Asteroid(botPosition, Math.ceil(50 / 2)); // Large asteroid
          asteroidBelt.roids.push(asteroid);
        } else {
          console.warn('DEBUG_ASTEROIDS', 'Skipping bot without valid position:', bot);
        }
      });

      console.info(
        'DEBUG_ASTEROIDS',
        `Placed ${bots.size} asteroids on top of bots for collision testing`
      );
    }
  }

  private addExtraAsteroidsForDebug(asteroidBelt: AsteroidBelt): void {
    // Verify belt instance is still valid
    if (asteroidBelt !== this.gameController.getCurrRoidBelt()) {
      return;
    }

    // Add MANY more asteroids for debug mode - we want A LOT!
    const extraAsteroidCount = 200; // Add 200 more asteroids for debug

    for (let i = 0; i < extraAsteroidCount; i++) {
      asteroidBelt.addRoid();
    }

    console.info(
      'DEBUG_ASTEROIDS',
      `Added ${extraAsteroidCount} extra asteroids. Total asteroids: ${asteroidBelt.roids.length}`
    );
  }

  /**
   * Inject debug functionality into the existing asteroid belt
   * This modifies the asteroid belt's methods at runtime without changing the core class
   */
  private injectDebugAsteroidFunctionality(): void {
    // Use a single timeout for injection, but coordinate with the main initialization
    const injectTimeout = window.setTimeout(() => {
      try {
        const asteroidBelt = this.gameController.getCurrRoidBelt();

        // Verify the belt is still valid before injection
        if (!asteroidBelt || typeof asteroidBelt.moveRoids !== 'function') {
          console.warn('DEBUG_ASTEROIDS', 'Asteroid belt not ready for injection, retrying...');
          // Retry injection after a short delay
          this.asteroidInjectionTimer = window.setTimeout(
            () => this.injectDebugAsteroidFunctionality(),
            50
          );
          return;
        }

        // Store original methods
        const originalMoveRoids = asteroidBelt.moveRoids.bind(asteroidBelt);
        const originalSpawnRoids = asteroidBelt.spawnRoids.bind(asteroidBelt);

        // Override moveRoids method
        asteroidBelt.moveRoids = function (this: AsteroidBeltWithDebug) {
          if (this.debugConfig?.disableAsteroidMovement) {
            return; // Don't move asteroids
          }
          return originalMoveRoids.call(this);
        }.bind(asteroidBelt);

        // Override spawnRoids method
        asteroidBelt.spawnRoids = function (this: AsteroidBeltWithDebug) {
          if (this.debugConfig?.disableAsteroidMultiplication) {
            // Log once when this condition is first met to avoid spam
            if (this.spawnTime === Math.ceil(this.spawnTime)) {
              console.info(
                'DEBUG_ASTEROIDS',
                'Asteroid multiplication disabled - no new asteroids will spawn'
              );
            }
            return; // Don't spawn new asteroids
          }
          return originalSpawnRoids.call(this);
        };

        // Add debug config to the asteroid belt for the overridden methods to access
        (asteroidBelt as AsteroidBeltWithDebug).debugConfig = this.debugConfig;

        console.info('DEBUG_ASTEROIDS', 'Injected debug functionality into asteroid belt');
      } catch (error) {
        console.warn('Could not inject debug asteroid functionality:', error);
      }
    }, 100);

    // Store the timeout ID for potential cleanup
    this.asteroidInjectionTimer = injectTimeout;
  }

  /**
   * Clean up any pending timers and reset state
   */
  public cleanup(): void {
    if (this.asteroidInitializationTimer) {
      clearTimeout(this.asteroidInitializationTimer);
      this.asteroidInitializationTimer = undefined;
    }
    if (this.asteroidInjectionTimer) {
      clearTimeout(this.asteroidInjectionTimer);
      this.asteroidInjectionTimer = undefined;
    }
    this.asteroidBeltReady = false;
  }

  // Override newGame to handle debug mode
  public newGame(): void {
    // Clean up any pending operations
    this.cleanup();

    // Call the original newGame method
    this.gameController.newGame();
  }

  // Override startGame to handle debug mode properly
  public startGame(): void {
    // Call the parent startGame to set up everything properly including input listeners
    this.gameController.startGame();

    // Clear any existing bots and create bots based on configuration
    this.debugMultiplayerManager.disableBots();
    const botCount = this.debugConfig.botCount;
    this.debugMultiplayerManager.enableBots(botCount);

    // Configure bot behavior based on settings
    if (this.debugConfig.disableBotMovement) {
      this.debugMultiplayerManager.disableBotMovement();
    }
  }

  public getCurrRoidBelt() {
    return this.gameController.getCurrRoidBelt();
  }

  public enableMultiplayer(): void {
    this.gameController.enableMultiplayer();
  }

  public enableBots(count: number): void {
    this.gameController.enableBots(count);
  }

  // Debug method to add even more asteroids
  public addMoreAsteroids(count: number = 10): void {
    const asteroidBelt = this.gameController.getCurrRoidBelt();

    for (let i = 0; i < count; i++) {
      asteroidBelt.addRoid();
    }

    console.info(
      'DEBUG_ASTEROIDS',
      `Added ${count} more asteroids. Total asteroids: ${asteroidBelt.roids.length}`
    );
  }

  // Debug method to get current asteroid count
  public getCurrentAsteroidCount(): number {
    return this.gameController.getCurrRoidBelt().roids.length;
  }

  // Get current player from game controller
  public getCurrPlayer() {
    return this.gameController.getCurrPlayer();
  }

  // Get current ship from game controller
  public getCurrShip() {
    return this.gameController.getCurrShip();
  }

  // Check if debug mode is active
  public isDebugMode(): boolean {
    return this.debugMode;
  }

  // Get current debug configuration
  public getDebugConfig() {
    return this.debugConfig;
  }

  // Update debug configuration at runtime
  public updateDebugConfig(newConfig: Partial<typeof this.debugConfig>): void {
    this.debugConfig = { ...this.debugConfig, ...newConfig };
    console.info('DEBUG_CONFIG', 'Debug configuration updated', this.debugConfig);

    // Apply configuration changes if debug mode is active
    if (this.debugMode) {
      this.applyDebugConfiguration();
    }
  }

  private applyDebugConfiguration(): void {
    try {
      // Update bot count if changed
      const currentBotCount = this.debugMultiplayerManager.getBots().size;
      if (currentBotCount !== this.debugConfig.botCount) {
        try {
          this.debugMultiplayerManager.disableBots();
          this.debugMultiplayerManager.enableBots(this.debugConfig.botCount);
        } catch (error) {
          console.error('DEBUG_CONFIG', 'Failed to update bot count:', error);
          // Revert to safe state
          this.debugMultiplayerManager.disableBots();
        }
      }

      // Update bot movement setting
      try {
        if (this.debugConfig.disableBotMovement) {
          this.debugMultiplayerManager.disableBotMovement();
        } else {
          this.debugMultiplayerManager.enableBotMovement();
        }
      } catch (error) {
        console.error('DEBUG_CONFIG', 'Failed to update bot movement:', error);
        // Revert to safe state
        this.debugMultiplayerManager.disableBotMovement();
      }
    } catch (error) {
      console.error('DEBUG_CONFIG', 'Failed to apply debug configuration:', error);
      // Ensure we're in a safe state
      try {
        this.debugMultiplayerManager.disableBots();
        this.debugMultiplayerManager.disableBotMovement();
      } catch (fallbackError) {
        console.error('DEBUG_CONFIG', 'Failed to revert to safe state:', fallbackError);
      }
    }
  }
}
