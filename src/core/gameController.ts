import type { AsteroidData } from '../../shared-types';
import { entityFactory } from '../entities/EntityFactory';
import type { RoidBelt } from '../entities/roid/Roid';
import { MultiplayerManager } from '../multiplayer/multiplayerManager';
import { toggleScreen } from '../ui/uiUtils';
import { DebugManager } from './services/DebugManager';
import { EMPPulseService } from './services/EMPPulseService';
import { GameStateManager } from './services/GameStateManager';
import { InputManager } from './services/InputManager';
import { PlayerManager } from './services/PlayerManager';

export class GameController {
  private static instance: GameController;

  private gameStateManager: GameStateManager;
  private playerManager: PlayerManager;
  private empPulseService: EMPPulseService;
  private inputManager: InputManager;
  private debugManager: DebugManager;
  private multiplayerManager: MultiplayerManager;

  private currRoidBelt: RoidBelt;

  private constructor() {
    this.gameStateManager = GameStateManager.getInstance();
    this.playerManager = PlayerManager.getInstance();
    this.empPulseService = EMPPulseService.getInstance();
    this.inputManager = InputManager.getInstance();
    this.debugManager = DebugManager.getInstance();
    this.multiplayerManager = MultiplayerManager.getInstance();

    this.currRoidBelt = entityFactory.createRoidBelt();

    // Expose game controller globally for testing
    if (typeof window !== 'undefined') {
      (window as { gameController?: GameController }).gameController = this;
    }
  }

  static getInstance(): GameController {
    if (!GameController.instance) {
      GameController.instance = new GameController();
    }
    return GameController.instance;
  }

  // Game lifecycle methods
  newGame(): void {
    this.gameStateManager.resetCurrentScore();

    // Create new player
    this.playerManager.createLocalPlayer();

    // Note: Asteroid belt creation is now handled in startGame() to support server-authoritative mode
  }

  async startGame(): Promise<void> {
    this.newGame();
    toggleScreen('start-screen', false);
    toggleScreen('gameArea', true);
    this.gameStateManager.toggleIsGameRunning();

    // Reset button text to default state
    this.inputManager.resetButtonText();

    // Try to connect to multiplayer first
    let isMultiplayer = false;
    try {
      await this.multiplayerManager.connect();
      isMultiplayer = true;
      console.debug('MULTIPLAYER', 'Connected to server, using server-authoritative asteroids');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn('Failed to connect to multiplayer, continuing with local game:', errorMessage);
      // Create local asteroids as fallback
      this.currRoidBelt = entityFactory.createRoidBelt();
      this.debugManager.applyDebugConfig(this.currRoidBelt);
    }

    // Initialize multiplayer systems if connected
    if (isMultiplayer) {
      this.multiplayerManager.initializeAsteroidSync();

      // Create a minimal asteroid belt for now - server will replace with authoritative asteroids
      this.currRoidBelt = entityFactory.createRoidBelt();
      this.multiplayerManager.setAsteroidBelt(this.currRoidBelt);
    }

    // Initialize listeners and bots
    const localPlayer = this.playerManager.getLocalPlayer();
    this.inputManager.initializeListeners(localPlayer);
    this.playerManager.setupBotShootHandler();

    // Initialize bots once when the game starts
    this.playerManager.initializeBots();

    // Set up server asteroid event listeners if in multiplayer mode
    if (isMultiplayer) {
      this.setupServerAsteroidListeners();
    }

    window.dispatchEvent(new CustomEvent('gameStart'));
  }

  private setupServerAsteroidListeners(): void {
    // Listen for server asteroid creation events
    window.addEventListener('serverAsteroidCreated', (event: Event) => {
      const customEvent = event as CustomEvent<{ asteroid: AsteroidData }>;
      const { asteroid } = customEvent.detail;
      console.debug('GAME', 'Adding server asteroid to local belt', asteroid.id);

      // Create a proper Roid object from server data
      const roid = entityFactory.createRoid({
        position: asteroid.position,
        size: asteroid.size,
      });

      // Override properties with server data
      roid.id = asteroid.id;
      roid.velocity = asteroid.velocity;
      roid.angle = asteroid.rotation;
      roid.angularVelocity = asteroid.angularVelocity;
      roid.health = asteroid.health;
      roid.maxHealth = asteroid.maxHealth;

      // Add to current asteroid belt if it exists
      if (this.currRoidBelt) {
        this.currRoidBelt.roids.push(roid);
      }
    });

    // Listen for server asteroid update events
    window.addEventListener('serverAsteroidUpdated', (event: Event) => {
      const customEvent = event as CustomEvent<{
        asteroidId: string;
        updates: Partial<AsteroidData>;
      }>;
      const { asteroidId, updates } = customEvent.detail;
      console.debug('GAME', 'Updating server asteroid in local belt', asteroidId);

      // Find and update the asteroid in the local belt
      if (this.currRoidBelt) {
        const roid = this.currRoidBelt.roids.find((r) => r.id === asteroidId);
        if (roid && updates) {
          if (updates.position) {
            roid.position = updates.position;
          }
          if (updates.velocity) {
            roid.velocity = updates.velocity;
          }
          if (updates.size !== undefined) {
            roid.r = updates.size;
          }
          // jaggedness is read-only in Roid class, skip updating it
          if (updates.rotation !== undefined) {
            roid.angle = updates.rotation;
          }
          if (updates.angularVelocity !== undefined) {
            roid.angularVelocity = updates.angularVelocity;
          }
          if (updates.health !== undefined) {
            roid.health = updates.health;
          }
          if (updates.maxHealth !== undefined) {
            roid.maxHealth = updates.maxHealth;
          }
        }
      }
    });

    // Listen for server asteroid destruction events
    window.addEventListener('serverAsteroidDestroyed', (event: Event) => {
      const customEvent = event as CustomEvent<{ asteroidId: string }>;
      const { asteroidId } = customEvent.detail;
      console.debug('GAME', 'Removing server asteroid from local belt', asteroidId);

      // Remove the asteroid from the local belt
      if (this.currRoidBelt) {
        const index = this.currRoidBelt.roids.findIndex((r) => r.id === asteroidId);
        if (index !== -1) {
          this.currRoidBelt.roids.splice(index, 1);
        }
      }
    });
  }

  gameOver(): void {
    this.gameStateManager.updateTextProperties('Game Over', 1.0);

    // Don't stop the game loop yet - let the text render for a few seconds
    setTimeout(() => {
      // Stop the game loop and return to main menu
      this.gameStateManager.toggleIsGameRunning();
      import('../ui/mainMenu').then(({ showGameOverMenu }) => {
        showGameOverMenu();
      });
    }, 2500);
  }

  // Getters for current game state
  getCurrShip() {
    return this.playerManager.getLocalShip();
  }

  getCurrPlayer() {
    return this.playerManager.getLocalPlayer();
  }

  getCurrRoidBelt(): RoidBelt {
    return this.currRoidBelt;
  }

  getCurrRoidCount(): number {
    return this.currRoidBelt.roids.length;
  }

  // Score management
  updateCurrScore(points: number): void {
    this.gameStateManager.updateCurrentScore(points);
  }

  getCurrScore(): number {
    return this.gameStateManager.getCurrentScore();
  }

  // Text display methods
  updateTextProperties(text: string, alpha: number): void {
    this.gameStateManager.updateTextProperties(text, alpha);
  }

  updateTextAlpha(alpha: number): void {
    this.gameStateManager.updateTextAlpha(alpha);
  }

  getTextAlpha(): number {
    return this.gameStateManager.getTextAlpha();
  }

  getText(): string {
    return this.gameStateManager.getText();
  }

  getIsGameRunning(): boolean {
    return this.gameStateManager.getIsGameRunning();
  }

  toggleIsGameRunning(): void {
    this.gameStateManager.toggleIsGameRunning();
  }

  // Multiplayer methods
  setPlayerName(name: string): void {
    this.playerManager.setPlayerName(name);
  }

  updateMultiplayerPlayerState(): void {
    this.playerManager.updateMultiplayerState();
  }

  getBots() {
    return this.playerManager.getBots();
  }

  getMultiplayerManager(): MultiplayerManager {
    return this.multiplayerManager;
  }

  // EMP pulse handling
  triggerEmpPulse(): void {
    const shipPosition = this.getCurrShip().position;
    this.empPulseService.triggerEmpPulse(shipPosition, this.currRoidBelt, (points) => {
      this.updateCurrScore(points);
    });
  }

  // Debug methods
  enableDebugMode(): void {
    this.debugManager.enableDebugMode();
  }

  isDebugMode(): boolean {
    return this.debugManager.isDebugMode();
  }

  // Getters for service access (for backward compatibility and testing)
  getGameStateManager(): GameStateManager {
    return this.gameStateManager;
  }

  getPlayerManager(): PlayerManager {
    return this.playerManager;
  }

  getEmpPulseService(): EMPPulseService {
    return this.empPulseService;
  }
}
