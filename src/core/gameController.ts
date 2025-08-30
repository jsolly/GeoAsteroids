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

    // Create new player and roid belt
    this.playerManager.createLocalPlayer();
    this.currRoidBelt = entityFactory.createRoidBelt();

    // Reset bot initialization flag for new game
    // This will be handled by PlayerManager when bots are initialized
  }

  async startGame(): Promise<void> {
    this.newGame();
    toggleScreen('start-screen', false);
    toggleScreen('gameArea', true);
    this.gameStateManager.toggleIsGameRunning();

    // Reset button text to default state
    this.inputManager.resetButtonText();

    // Setup debug mode first to get the correct bot count
    this.debugManager.applyDebugConfig(this.currRoidBelt);

    // Connect to multiplayer and adjust roids once connected
    try {
      await this.multiplayerManager.connect();
      // Debug config will be applied if debug mode is enabled
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn('Failed to connect to multiplayer, continuing with local game:', errorMessage);
    }

    // Initialize listeners and bots
    const localPlayer = this.playerManager.getLocalPlayer();
    this.inputManager.initializeListeners(localPlayer);
    this.playerManager.setupBotShootHandler();

    // Initialize bots once when the game starts
    this.playerManager.initializeBots();

    window.dispatchEvent(new CustomEvent('gameStart'));
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
