import { SHIP_COLLISION_DAMAGE } from '../constants/entities/ship';
import { DEFAULT_BOT_COUNT, EMP_PULSE_RADIUS } from '../constants/game';
import { type AsteroidBelt, createAsteroidBelt } from '../entities/asteroid/Asteroid';
import { BotManager } from '../entities/bot/botManager';
import type { BotShoot } from '../entities/bot/types';
import { Player } from '../entities/player/Player';
import type { Ship } from '../entities/ship/Ship';
import { keyDown, keyUp } from '../input/keybindings';
import { MultiplayerManager } from '../multiplayer/multiplayerManager';
import { toggleScreen } from '../ui/uiUtils';
import { GameState } from './gameState';

// Type for asteroid belt with debug configuration
interface DebugAsteroidBelt extends AsteroidBelt {
  debugConfig?: {
    botCount: number;
    disableMovement: boolean;
    disableBotMovement: boolean;
    disableBotGuns: boolean;
    placeAsteroidOnBot: boolean;
    debugAsteroidCount: number;
    localPlayerInvincible: boolean;
    drawAsteroids: boolean;
    disableAsteroidMultiplication: boolean;
    disableAsteroidMovement: boolean;
    disableBotSpawnProtection: boolean;
  };
}

function initializeListeners(isGameRunning: () => boolean): void {
  document.addEventListener('keydown', (ev) => {
    if (isGameRunning()) {
      keyDown(ev, GameController.getInstance().getCurrPlayer());
    }
  });

  document.addEventListener('keyup', (ev) => {
    if (isGameRunning()) {
      keyUp(ev, GameController.getInstance().getCurrPlayer());
    }
  });
}

interface GameControllerData {
  levelUp(): void;
  newGame(): void;
  startGame(): void;
  gameOver(): void;
  getCurrShip(): Ship;
  getCurrPlayer(): Player;
  getCurrRoidBelt(): AsteroidBelt;
  updateCurrScore(points: number): void;
  updatePersonalBest(): void;
  updateTextProperties(text: string, alpha: number): void;
  getNextLevel(): number;
  getCurrScore(): number;
  getIsGameRunning(): boolean;
  toggleIsGameRunning(): void;
}

class GameController implements GameControllerData {
  private static instance: GameController;
  private gameState: GameState;
  private currShip: Ship;
  private player: Player;
  private currRoidBelt: AsteroidBelt;
  private multiplayerManager: MultiplayerManager;
  private botShootHandler?: (event: CustomEvent) => void;
  private debugMode: boolean = false;

  private constructor() {
    this.gameState = GameState.getInstance();
    // Create player (it will create its own ship)
    this.player = Player.createPlayer({
      name: 'LocalPlayer',
    });
    this.currShip = this.player.ship;
    this.currRoidBelt = createAsteroidBelt();
    this.multiplayerManager = MultiplayerManager.getInstance();

    // Set up EMP pulse event listener
    this.setupEmpPulseHandler();

    // Set up player game over event listener
    this.setupPlayerGameOverHandler();

    // Expose game controller globally for testing
    if (typeof window !== 'undefined') {
      (window as { gameController?: GameController }).gameController = this;
    }
  }

  private setupPlayerGameOverHandler(): void {
    window.addEventListener('playerGameOver', (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.playerId === this.player.id) {
        this.gameOver();
      }
    });
  }

  public static getInstance(): GameController {
    if (!GameController.instance) {
      GameController.instance = new GameController();
    }
    return GameController.instance;
  }

  levelUp(): void {
    this.gameState.updateCurrentLevel();
    this.gameState.updateNextLevel();
    const currLevel = this.gameState.getCurrentLevel();
    const text = `Level ${String(currLevel)}`;
    const textAlpha = 1.0;
    this.updateTextProperties(text, textAlpha);
    this.currRoidBelt.addRoid();
  }

  newGame(): void {
    this.gameState.resetCurrentScore();
    this.gameState.resetCurrentLevel();
    // Create player (it will create its own ship)
    this.player = Player.createPlayer({
      name: 'LocalPlayer',
    });
    this.currShip = this.player.ship;
    this.currRoidBelt = createAsteroidBelt();
  }

  startGame(): void {
    this.newGame();
    toggleScreen('start-screen', false);
    toggleScreen('gameArea', true);
    this.toggleIsGameRunning();
    initializeListeners(() => this.getIsGameRunning());

    // Reset button text to default state
    this.resetButtonText();

    // Reset bot movement system debug flags for new game
    const botManager = BotManager.getInstance();
    botManager.resetDebugFlags();

    // Always initialize bots for multiplayer mode
    // Bots work independently of websocket connections
    this.multiplayerManager.initializeBots(DEFAULT_BOT_COUNT);

    // Setup debug mode if enabled
    this.setupDebugMode();

    // Connect to multiplayer and adjust asteroids once connected
    this.multiplayerManager
      .connect()
      .then(() => {
        if (this.currRoidBelt) {
          this.currRoidBelt.adjustForMultiplayer();

          // Setup debug asteroids after multiplayer adjustment
          this.setupDebugAsteroids();
        }
      })
      .catch((error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn('Failed to connect to multiplayer, continuing with local game:', errorMessage);

        // Setup debug asteroids even if multiplayer fails
        this.setupDebugAsteroids();
      });

    window.dispatchEvent(new CustomEvent('gameStart'));
  }

  gameOver(): void {
    this.updateTextProperties('Game Over', 1.0);

    // Don't stop the game loop yet - let the text render for a few seconds
    // The text will fade out over TEXT_FADE_TIME (2.5 seconds)
    // Then we'll return to main menu
    setTimeout(() => {
      // Stop the game loop and return to main menu
      this.toggleIsGameRunning();
      import('../ui/mainMenu').then(({ showGameOverMenu }) => {
        showGameOverMenu();
      });
    }, 2500); // Wait for text to fade out completely
  }

  getCurrShip(): Ship {
    return this.currShip;
  }

  getCurrPlayer(): Player {
    return this.player;
  }
  getCurrRoidBelt(): AsteroidBelt {
    return this.currRoidBelt;
  }

  getCurrAsteroidCount(): number {
    return this.currRoidBelt.roids.length;
  }

  updateCurrScore(points: number): void {
    this.gameState.updateCurrentScore(points);
  }
  updatePersonalBest(): void {
    this.gameState.updatePersonalBest();
  }
  getPersonalBest(): number {
    return this.gameState.getPersonalBest();
  }

  getNextLevel(): number {
    return this.gameState.getNextLevel();
  }
  getCurrScore(): number {
    return this.gameState.getCurrentScore();
  }
  updateTextProperties(text: string, alpha: number): void {
    this.gameState.updateTextProperties(text, alpha);
  }
  updateTextAlpha(alpha: number): void {
    this.gameState.updateTextAlpha(alpha);
  }
  getTextAlpha(): number {
    return this.gameState.getTextAlpha();
  }
  getText(): string {
    return this.gameState.getText();
  }
  getIsGameRunning(): boolean {
    return this.gameState.getIsGameRunning();
  }
  toggleIsGameRunning(): void {
    this.gameState.toggleIsGameRunning();
  }

  // Reset button text to default state
  private resetButtonText(): void {
    const multiplayerBtn = document.getElementById('start-multiplayer') as HTMLButtonElement;

    if (multiplayerBtn) {
      multiplayerBtn.innerText = '🌐 Start Multiplayer Game';
    }
  }

  // Multiplayer methods
  // Method to set player name for multiplayer
  setPlayerName(name: string): void {
    this.multiplayerManager.setLocalPlayerName(name);
  }

  updateMultiplayerPlayerState(): void {
    if (this.multiplayerManager.isConnected) {
      this.multiplayerManager.updatePlayerState({
        position: this.currShip.position,
        velocity: this.currShip.velocity,
        r: this.currShip.r,
        angle: this.currShip.angle,
        lives: this.player.lives,
        score: this.gameState.getCurrentScore(),
        exploding: this.currShip.exploding,
      });

      // Update bot manager with local player position
      this.multiplayerManager.updateLocalPlayerForAllPlayers(
        this.currShip.position,
        !this.player.isDead
      );
    }
  }

  // Bot management methods - bots are always present in multiplayer mode
  getBots(): Map<string, Player> {
    return this.multiplayerManager.getBots();
  }

  getMultiplayerManager(): MultiplayerManager {
    return this.multiplayerManager;
  }

  // Handle bot shooting events
  public setupBotShootHandler(): void {
    if (this.botShootHandler) {
      return;
    }

    this.botShootHandler = (event: CustomEvent): void => {
      const botShoot = event.detail as BotShoot;
      this.handleBotShoot(botShoot);
    };

    window.addEventListener('botShoot', this.botShootHandler as EventListener);
  }

  private handleBotShoot(botShoot: BotShoot): void {
    // Check if the bot shot hits the player
    if (this.checkBotLaserHit(botShoot)) {
      // Check if ship is invincible (blinking)
      if (this.currShip.blinkCount > 0 || this.currShip.exploding) {
        return; // No damage taken
      }

      // Damage the player using the damage system instead of bypassing it
      this.currShip.takeDamage(SHIP_COLLISION_DAMAGE); // Bot laser damage (same as collision damage)

      // The takeDamage method will handle life loss and respawn
      // We don't need to manually manage lives or call die() here
    }
  }

  private checkBotLaserHit(botShoot: BotShoot): boolean {
    // Simple collision detection between bot laser and player ship
    const laserStart = { x: botShoot.laserStart.x, y: botShoot.laserStart.y };
    const laserDirection = { x: botShoot.laserDirection.x, y: botShoot.laserDirection.y };
    const shipPos = this.currShip.position;
    const shipRadius = this.currShip.r;

    // Calculate distance from laser line to ship center
    const laserEndX = laserStart.x + laserDirection.x * 1000; // Extend laser
    const laserEndY = laserStart.y + laserDirection.y * 1000;

    // Calculate perpendicular distance from point to line
    // Using line equation: Ax + By + C = 0
    const lineCoeffA = laserEndY - laserStart.y;
    const lineCoeffB = laserStart.x - laserEndX;
    const lineCoeffC = laserEndX * laserStart.y - laserStart.x * laserEndY;

    const distance =
      Math.abs(lineCoeffA * shipPos.x + lineCoeffB * shipPos.y + lineCoeffC) /
      Math.sqrt(lineCoeffA * lineCoeffA + lineCoeffB * lineCoeffB);

    // Debug collision detection
    // Check if laser passes close enough to ship

    // Check if laser passes close enough to ship
    return distance <= shipRadius;
  }

  // Getter for gameState
  getGameState(): GameState {
    return this.gameState;
  }

  // EMP Pulse handling
  private setupEmpPulseHandler(): void {
    window.addEventListener('empPulse', (event: Event) => {
      const empEvent = event as CustomEvent<{
        shipPosition: { x: number; y: number };
        shipRadius: number;
      }>;
      this.handleEmpPulse(empEvent.detail);
    });
  }

  private handleEmpPulse(detail: {
    shipPosition: { x: number; y: number };
    shipRadius: number;
  }): void {
    const { shipPosition } = detail;

    // Destroy all asteroids within EMP radius
    this.destroyAsteroidsInRadius(shipPosition, EMP_PULSE_RADIUS);

    // Destroy all bots within EMP radius
    this.destroyBotsInRadius(shipPosition, EMP_PULSE_RADIUS);
  }

  private destroyAsteroidsInRadius(center: { x: number; y: number }, radius: number): void {
    const roids = this.currRoidBelt.roids;

    for (let i = roids.length - 1; i >= 0; i--) {
      const roid = roids[i];
      const distance = Math.sqrt(
        (roid.position.x - center.x) ** 2 + (roid.position.y - center.y) ** 2
      );

      if (distance <= radius) {
        // Add score for destroyed asteroid
        const score = this.getAsteroidScore(roid.r);
        this.updateCurrScore(score);

        // Remove asteroid
        roids.splice(i, 1);
      }
    }
  }

  private destroyBotsInRadius(center: { x: number; y: number }, radius: number): void {
    const bots = this.multiplayerManager.getBots();

    // Collect bot IDs to destroy first, then destroy them
    // This avoids issues with modifying the Map during iteration
    const botsToDestroy: string[] = [];

    for (const [botId, bot] of bots.entries()) {
      const distance = Math.sqrt(
        (bot.ship.position.x - center.x) ** 2 + (bot.ship.position.y - center.y) ** 2
      );

      if (distance <= radius) {
        botsToDestroy.push(botId);
      }
    }

    // Now destroy all detected bots
    for (const botId of botsToDestroy) {
      this.multiplayerManager.empDestroyPlayer(botId);

      // Add points for destroying a bot with EMP (same as laser kill)
      this.updateCurrScore(200);
    }
  }

  private getAsteroidScore(radius: number): number {
    if (radius >= Math.ceil(50 / 2)) {
      return 20; // Large asteroid
    }
    if (radius >= Math.ceil(50 / 4)) {
      return 50; // Medium asteroid
    }
    return 100; // Small asteroid
  }

  // Debug mode setup methods
  public enableDebugMode(): void {
    this.debugMode = true;

    // Enable debug mode in collision utilities
    import('../physics/collision/collisionUtils').then(({ enableDebugMode }) => {
      enableDebugMode();
    });
  }

  public isDebugMode(): boolean {
    return this.debugMode;
  }

  private setupDebugMode(): void {
    // Only setup debug mode if explicitly enabled
    if (this.debugMode) {
      this.setupDebugBots();
    }
  }

  private setupDebugBots(): void {
    try {
      const debugConfig = this.getDebugConfig();

      // Clear existing bots and create new ones based on debug config
      this.multiplayerManager.initializeBots(debugConfig.botCount);

      // Configure bot behavior based on settings - only when debug mode is enabled
      if (this.debugMode && debugConfig.disableBotMovement) {
        const botManager = BotManager.getInstance();
        if (botManager?.botMovementSystem) {
          botManager.botMovementSystem.debugMovementDisabled = true;
        }
      }
    } catch (error) {
      console.error('DEBUG', 'Failed to setup debug bots:', error);
    }
  }

  private setupDebugAsteroids(): void {
    // Setup debug asteroids if debug mode is enabled
    if (this.debugMode) {
      // Wait a bit for the asteroid belt to be fully initialized
      setTimeout(() => {
        try {
          this.setupDebugAsteroidsInBelt();
          this.injectDebugAsteroidBehavior();
        } catch (error) {
          console.warn('Failed to setup debug asteroids:', error);
        }
      }, 100);
    }
  }

  private setupDebugAsteroidsInBelt(): void {
    try {
      const debugConfig = this.getDebugConfig();

      // Override asteroid count for debug mode - only when debug mode is enabled
      if (this.debugMode && debugConfig.drawAsteroids) {
        // Clear existing asteroids and add the debug amount
        this.currRoidBelt.roids = [];

        // Add the debug asteroid count from config
        for (let i = 0; i < debugConfig.debugAsteroidCount; i++) {
          this.currRoidBelt.addRoid();
        }
      } else if (this.debugMode && !debugConfig.drawAsteroids) {
        // Clear all asteroids when drawing is disabled - only in debug mode
        this.currRoidBelt.roids = [];
      }

      // Place asteroids on bots if configured - only when debug mode is enabled
      if (this.debugMode && debugConfig.placeAsteroidOnBot) {
        this.placeAsteroidsOnBots();
      }

      // Add extra asteroids for debug mode - only when debug mode is enabled
      if (this.debugMode && debugConfig.drawAsteroids) {
        this.addExtraAsteroidsForDebug();
      }
    } catch (error) {
      console.error('DEBUG', 'Failed to setup debug asteroids:', error);
    }
  }

  private placeAsteroidsOnBots(): void {
    const bots = this.multiplayerManager.getBots();
    if (bots.size > 0) {
      let _asteroidsPlaced = 0;
      bots.forEach((bot, _botId) => {
        if (bot?.ship?.position) {
          const botPosition = bot.ship.position;
          // Create an asteroid at the bot's position for collision testing
          import('../entities/asteroid/Asteroid').then(({ Asteroid }) => {
            const asteroid = new Asteroid(botPosition, Math.ceil(50 / 2)); // Large asteroid
            this.currRoidBelt.roids.push(asteroid);
            _asteroidsPlaced++;
          });
        }
      });
    }
  }

  private addExtraAsteroidsForDebug(): void {
    // Add extra asteroids for debug mode
    const extraAsteroidCount = 200;
    for (let i = 0; i < extraAsteroidCount; i++) {
      this.currRoidBelt.addRoid();
    }
  }

  private injectDebugAsteroidBehavior(): void {
    try {
      const debugConfig = this.getDebugConfig();

      // Store original methods
      const originalMoveRoids = this.currRoidBelt.moveRoids.bind(this.currRoidBelt);
      const originalSpawnRoids = this.currRoidBelt.spawnRoids.bind(this.currRoidBelt);

      // Override moveRoids method - only when debug mode is enabled
      this.currRoidBelt.moveRoids = () => {
        if (
          this.debugMode &&
          (this.currRoidBelt as DebugAsteroidBelt).debugConfig?.disableAsteroidMovement
        ) {
          return; // Don't move asteroids
        }
        return originalMoveRoids.call(this.currRoidBelt);
      };

      // Override spawnRoids method - only when debug mode is enabled
      this.currRoidBelt.spawnRoids = () => {
        if (
          this.debugMode &&
          (this.currRoidBelt as DebugAsteroidBelt).debugConfig?.disableAsteroidMultiplication
        ) {
          return; // Don't spawn new asteroids
        }
        return originalSpawnRoids.call(this.currRoidBelt);
      };

      // Add debug config to the asteroid belt for the overridden methods to access - only when debug mode is enabled
      if (this.debugMode) {
        (this.currRoidBelt as DebugAsteroidBelt).debugConfig = debugConfig;
      }
    } catch (error) {
      console.warn('DEBUG', 'Could not inject debug asteroid functionality:', error);
    }
  }

  private getDebugConfig() {
    return {
      botCount: parseInt(import.meta.env.VITE_DEBUG_BOT_COUNT || '1', 10),
      disableMovement: import.meta.env.VITE_DEBUG_DISABLE_MOVEMENT === 'true',
      disableBotMovement: import.meta.env.VITE_DEBUG_DISABLE_BOT_MOVEMENT === 'true',
      disableBotGuns: import.meta.env.VITE_DEBUG_DISABLE_BOT_GUNS === 'true',
      placeAsteroidOnBot: import.meta.env.VITE_DEBUG_PLACE_ASTEROID_ON_BOT === 'true',
      debugAsteroidCount: parseInt(import.meta.env.VITE_DEBUG_ASTEROID_COUNT || '100', 10),
      localPlayerInvincible: import.meta.env.VITE_DEBUG_LOCAL_PLAYER_INVINCIBLE === 'true',
      drawAsteroids: import.meta.env.VITE_DEBUG_DRAW_ASTEROIDS !== 'false',
      disableAsteroidMultiplication:
        import.meta.env.VITE_DEBUG_DISABLE_ASTEROID_MULTIPLICATION === 'true',
      disableAsteroidMovement: import.meta.env.VITE_DEBUG_DISABLE_ASTEROID_MOVEMENT === 'true',
      disableBotSpawnProtection: import.meta.env.VITE_DEBUG_DISABLE_BOT_SPAWN_PROTECTION === 'true',
    };
  }
}

export { GameController };
