import { DEBUG_ROID_COUNT, ROID_SIZE } from '../constants/entities/roid';
import { SHIP_COLLISION_DAMAGE } from '../constants/entities/ship';
import { DEFAULT_BOT_COUNT, EMP_PULSE_RADIUS } from '../constants/game';
import { BotManager } from '../entities/bot/botManager';
import type { BotShoot } from '../entities/bot/types';
import { Player } from '../entities/player/Player';
import { createRoidBelt, type RoidBelt } from '../entities/roid/Roid';
import type { Ship } from '../entities/ship/Ship';
import { keyDown, keyUp } from '../input/keybindings';
import { MultiplayerManager } from '../multiplayer/multiplayerManager';
import { toggleScreen } from '../ui/uiUtils';
import { getRandomPositionWithinBoundary } from '../utils/positionUtils';
import { GameState } from './gameState';

// Type for roid belt with debug configuration
interface DebugRoidBelt extends RoidBelt {
  debugConfig?: {
    botCount: number;
    disableMovement: boolean;
    disableBotMovement: boolean;
    disableBotGuns: boolean;
    placeRoidOnBot: boolean;
    debugRoidCount: number;
    localPlayerInvincible: boolean;
    drawRoids: boolean;

    disableRoidMovement: boolean;
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
  getCurrShip(): Ship;
  getCurrPlayer(): Player;
  getCurrRoidBelt(): RoidBelt;
  getCurrScore(): number;
  getCurrRoidCount(): number;
  getIsGameRunning(): boolean;
  updateCurrScore(points: number): void;
  updateTextProperties(text: string, alpha: number): void;
  newGame(): void;
  startGame(): void;
  gameOver(): void;
  toggleIsGameRunning(): void;
  getBots(): Map<string, Player>;
  getMultiplayerManager(): MultiplayerManager;
}

class GameController implements GameControllerData {
  private static instance: GameController;
  private gameState: GameState;
  private currShip: Ship;
  private player: Player;
  private currRoidBelt: RoidBelt;
  private multiplayerManager: MultiplayerManager;
  private botShootHandler?: (event: CustomEvent) => void;
  private debugMode: boolean = false;

  private constructor() {
    this.gameState = GameState.getInstance();
    // Create player (it will create its own ship)
    this.player = Player.createPlayer({
      id: 'local-player',
      name: 'LocalPlayer',
      type: 'local',
      position: getRandomPositionWithinBoundary(),
    });
    this.currShip = this.player.ship;
    this.currRoidBelt = createRoidBelt();
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

  newGame(): void {
    this.gameState.resetCurrentScore();
    // Create player (it will create its own ship)
    this.player = Player.createPlayer({
      id: 'local-player',
      name: 'LocalPlayer',
      type: 'local',
      position: getRandomPositionWithinBoundary(),
    });
    this.currShip = this.player.ship;
    this.currRoidBelt = createRoidBelt();
  }

  startGame(): void {
    this.newGame();
    toggleScreen('start-screen', false);
    toggleScreen('gameArea', true);
    this.toggleIsGameRunning();
    initializeListeners(() => this.getIsGameRunning());

    // Reset button text to default state
    this.resetButtonText();

    // Always initialize bots for multiplayer mode
    // Bots work independently of websocket connections
    this.multiplayerManager.initializeBots(DEFAULT_BOT_COUNT);

    // Setup debug mode if enabled
    this.setupDebugMode();

    // Connect to multiplayer and adjust roids once connected
    this.multiplayerManager
      .connect()
      .then(() => {
        if (this.currRoidBelt) {
          // Setup debug roids directly
          this.setupDebugRoids();
        }
      })
      .catch((error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn('Failed to connect to multiplayer, continuing with local game:', errorMessage);

        // Setup debug roids even if multiplayer fails
        this.setupDebugRoids();
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
  getCurrRoidBelt(): RoidBelt {
    return this.currRoidBelt;
  }

  getCurrRoidCount(): number {
    return this.currRoidBelt.roids.length;
  }

  updateCurrScore(points: number): void {
    this.gameState.updateCurrentScore(points);
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

    // Destroy all roids within EMP radius
    this.destroyRoidsInRadius(shipPosition, EMP_PULSE_RADIUS);

    // Destroy all bots within EMP radius
    this.destroyBotsInRadius(shipPosition, EMP_PULSE_RADIUS);
  }

  private destroyRoidsInRadius(center: { x: number; y: number }, radius: number): void {
    const roids = this.currRoidBelt.roids;

    for (let i = roids.length - 1; i >= 0; i--) {
      const roid = roids[i];
      const distance = Math.sqrt(
        (roid.position.x - center.x) ** 2 + (roid.position.y - center.y) ** 2
      );

      if (distance <= radius) {
        // Add score for destroyed roid
        const score = this.getRoidScore(roid.r);
        this.updateCurrScore(score);

        // Remove roid
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

  private getRoidScore(radius: number): number {
    if (radius >= Math.ceil(50 / 2)) {
      return 20; // Large roid
    }
    if (radius >= Math.ceil(50 / 4)) {
      return 50; // Medium roid
    }
    return 100; // Small roid
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
      console.error('Error setting up debug bots:', error);
    }
  }

  private setupDebugRoids(): void {
    // Setup debug roids if debug mode is enabled
    if (this.debugMode) {
      // Wait a bit for the roid belt to be fully initialized
      setTimeout(() => {
        try {
          this.setupDebugRoidsInBelt();
          this.injectDebugRoidBehavior();
        } catch (error) {
          console.error('Error setting up debug roids:', error);
        }
      }, 100);
    }
  }

  private setupDebugRoidsInBelt(): void {
    try {
      const debugConfig = this.getDebugConfig();

      // Override roid count for debug mode - only when debug mode is enabled
      if (this.debugMode && debugConfig.drawRoids) {
        // Set debug limits for roid count
        this.currRoidBelt.setRoidLimits(debugConfig.debugRoidCount, debugConfig.debugRoidCount);

        // Clear existing roids and set the exact count
        this.currRoidBelt.roids = [];

        // Set the total roid count to the debug config value
        for (let i = 0; i < debugConfig.debugRoidCount; i++) {
          this.currRoidBelt.addRoid();
        }
      } else if (this.debugMode && !debugConfig.drawRoids) {
        // Clear all roids when drawing is disabled - only in debug mode
        this.currRoidBelt.roids = [];
        this.currRoidBelt.setRoidLimits(0, 0);
      }

      // Place roids on bots if configured - only when debug mode is enabled
      if (this.debugMode && debugConfig.placeRoidOnBot) {
        this.placeRoidsOnBots();
      }
    } catch (error) {
      console.error('Error setting up debug roids:', error);
    }
  }

  private placeRoidsOnBots(): void {
    const bots = this.multiplayerManager.getBots();
    if (bots.size > 0) {
      let _roidsPlaced = 0;
      bots.forEach((bot, _botId) => {
        if (bot?.ship?.position) {
          const botPosition = bot.ship.position;
          // Create a roid at the bot's position for collision testing
          import('../entities/roid/Roid').then(({ Roid }) => {
            const roid = new Roid(botPosition, Math.ceil(ROID_SIZE / 2)); // Large roid
            this.currRoidBelt.roids.push(roid);
            _roidsPlaced++;
          });
        }
      });
    }
  }

  private injectDebugRoidBehavior(): void {
    try {
      const debugConfig = this.getDebugConfig();

      // Store original methods
      const originalMoveRoids = this.currRoidBelt.moveRoids.bind(this.currRoidBelt);

      // Override moveRoids method - only when debug mode is enabled
      this.currRoidBelt.moveRoids = () => {
        if (
          this.debugMode &&
          (this.currRoidBelt as DebugRoidBelt).debugConfig?.disableRoidMovement
        ) {
          return; // Don't move roids
        }
        return originalMoveRoids.call(this.currRoidBelt);
      };

      // Add debug config to the roid belt for the overridden methods to access - only when debug mode is enabled
      if (this.debugMode) {
        (this.currRoidBelt as DebugRoidBelt).debugConfig = debugConfig;
      }
    } catch (error) {
      console.error('Error injecting debug roid behavior:', error);
    }
  }

  private getDebugConfig() {
    return {
      botCount: parseInt(import.meta.env.VITE_DEBUG_BOT_COUNT || '1', 10),
      disableMovement: import.meta.env.VITE_DEBUG_DISABLE_MOVEMENT === 'true',
      disableBotMovement: import.meta.env.VITE_DEBUG_DISABLE_BOT_MOVEMENT === 'true',
      disableBotGuns: import.meta.env.VITE_DEBUG_DISABLE_BOT_GUNS === 'true',
      placeRoidOnBot: import.meta.env.VITE_DEBUG_PLACE_ROID_ON_BOT === 'true',
      debugRoidCount: parseInt(
        import.meta.env.VITE_DEBUG_ROID_COUNT || DEBUG_ROID_COUNT.toString(),
        10
      ),
      localPlayerInvincible: import.meta.env.VITE_DEBUG_LOCAL_PLAYER_INVINCIBLE === 'true',
      drawRoids: import.meta.env.VITE_DEBUG_DRAW_ROIDS !== 'false',

      disableRoidMovement: import.meta.env.VITE_DEBUG_DISABLE_ROID_MOVEMENT === 'true',
      disableBotSpawnProtection: import.meta.env.VITE_DEBUG_DISABLE_BOT_SPAWN_PROTECTION === 'true',
    };
  }
}

export { GameController };
