import { SHIP_COLLISION_DAMAGE } from '../constants/entities/ship';
import { DEFAULT_BOT_COUNT, EMP_PULSE_RADIUS } from '../constants/game';
import type { BotShoot } from '../entities/bot/types';
import type { Player } from '../entities/player/Player';
import { playerFactory } from '../entities/player/PlayerFactory';
import { PlayerNetwork } from '../entities/player/playerNetwork';
import { createRoidBelt, type RoidBelt } from '../entities/roid/Roid';
import type { Ship } from '../entities/ship/Ship';
import { keyDown, keyUp } from '../input/keybindings';
import { MultiplayerManager } from '../multiplayer/multiplayerManager';
import { toggleScreen } from '../ui/uiUtils';
import { isDebugMode } from '../utils/debugUtils';
import { getRandomPositionWithinBoundary } from '../utils/positionUtils';
import { GameState } from './gameState';

// Type for roid belt with debug configuration
interface DebugRoidBelt extends RoidBelt {
  debugConfig?: {
    botCount: number;
    debugRoidCount: number;
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

export class GameController {
  private static instance: GameController;
  private gameState: GameState;
  private multiplayerManager: MultiplayerManager;
  private player: Player;
  private currShip: Ship;
  private currRoidBelt: RoidBelt;
  private botShootHandler?: (event: CustomEvent) => void;
  private botsInitialized: boolean = false;

  private constructor() {
    this.gameState = GameState.getInstance();
    this.multiplayerManager = MultiplayerManager.getInstance();
    // Create player with proper name from multiplayer manager
    this.player = playerFactory.createLocalPlayer(
      this.multiplayerManager.getLocalPlayerName(),
      getRandomPositionWithinBoundary()
    );
    this.currShip = this.player.ship;
    this.currRoidBelt = createRoidBelt();

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
    // Create player with proper name from multiplayer manager
    this.player = playerFactory.createLocalPlayer(
      this.multiplayerManager.getLocalPlayerName(),
      getRandomPositionWithinBoundary()
    );
    this.currShip = this.player.ship;
    this.currRoidBelt = createRoidBelt();

    // Reset bot initialization flag for new game
    this.botsInitialized = false;
  }

  startGame(): void {
    this.newGame();
    toggleScreen('start-screen', false);
    toggleScreen('gameArea', true);
    this.toggleIsGameRunning();
    initializeListeners(() => this.getIsGameRunning());

    // Reset button text to default state
    this.resetButtonText();

    // Setup debug mode first to get the correct bot count
    this.setupDebugMode();

    // Connect to multiplayer and adjust roids once connected
    this.multiplayerManager
      .connect()
      .then(() => {
        if (this.currRoidBelt) {
          // Debug config will be applied if debug mode is enabled
        }
      })
      .catch((error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn('Failed to connect to multiplayer, continuing with local game:', errorMessage);

        // Debug config will be applied if debug mode is enabled
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
    }

    // Always update bots with local player info, even when offline
    this.multiplayerManager.updateLocalPlayerForAllPlayers(
      this.currShip.position,
      !this.player.isDead
    );

    // Initialize bots once when the game starts (after player position is established)
    if (!this.botsInitialized) {
      const botCount = this.isDebugMode()
        ? parseInt(import.meta.env.VITE_DEBUG_BOT_COUNT || '1', 10)
        : DEFAULT_BOT_COUNT;

      this.multiplayerManager.initializeBots(botCount);
      this.botsInitialized = true;
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
    const playerNetwork = PlayerNetwork.getInstance();

    // Get only bot players for destruction
    const bots = playerNetwork.getBotPlayers();

    // Collect bot IDs to destroy first, then destroy them
    const botsToDestroy: string[] = [];

    for (const bot of bots) {
      const distance = Math.sqrt(
        (bot.ship.position.x - center.x) ** 2 + (bot.ship.position.y - center.y) ** 2
      );

      if (distance <= radius) {
        botsToDestroy.push(bot.id);
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
    // This method is now deprecated - debug mode is auto-enabled via environment
    console.warn(
      'enableDebugMode() is deprecated - debug mode is now controlled via VITE_CLIENT_LOG_LEVEL=debug'
    );
  }

  public isDebugMode(): boolean {
    return isDebugMode();
  }

  private setupDebugMode(): void {
    // Auto-setup debug mode if environment indicates it should be enabled
    if (isDebugMode()) {
      this.applyDebugConfig();
    }
  }

  private applyDebugConfig(): void {
    if (!isDebugMode()) {
      return;
    }

    try {
      const debugConfig = this.getDebugConfig();

      // Bot count is now handled during initialization, no need to reinitialize here

      // Apply roid count from env var
      if (debugConfig.debugRoidCount !== 10) {
        this.currRoidBelt.setRoidLimits(debugConfig.debugRoidCount, debugConfig.debugRoidCount);
        // Clear and recreate roids to match the new count
        this.currRoidBelt.roids = [];
        for (let i = 0; i < debugConfig.debugRoidCount; i++) {
          this.currRoidBelt.addRoid();
        }
      }

      // Store debug config for any other systems that need it
      (this.currRoidBelt as DebugRoidBelt).debugConfig = debugConfig;
    } catch (error) {
      console.error('Error applying debug config:', error);
    }
  }

  private getDebugConfig() {
    return {
      botCount: parseInt(import.meta.env.VITE_DEBUG_BOT_COUNT || '1', 10),
      debugRoidCount: parseInt(import.meta.env.VITE_DEBUG_ROID_COUNT || '100', 10),
    };
  }
}
