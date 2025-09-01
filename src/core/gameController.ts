import type { AsteroidData } from '../../shared-types';
import { entityFactory } from '../entities/EntityFactory';
import type { RoidBelt } from '../entities/roid/Roid';
import { MultiplayerManager } from '../multiplayer/multiplayerManager';
import { toggleScreen } from '../ui/uiUtils';
import { logger } from '../utils/Logger';
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

    // Initialize with empty asteroid belt - will be populated by server
    this.currRoidBelt = entityFactory.createEmptyRoidBelt();

    // Set up multiplayer disconnection handler
    this.setupMultiplayerDisconnectionHandler();

    // Set up game over handler
    this.setupGameOverHandler();

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
    try {
      await this.multiplayerManager.connect();

      // Add a small delay to ensure WebSocket state is fully established
      await new Promise((resolve) => setTimeout(resolve, 100));

      logger.debug('MULTIPLAYER', 'Connected to server, using server-authoritative game state');
    } catch (error) {
      // Connection failed - this is a fatal error since we only support multiplayer
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorType = this.categorizeConnectionError(error);

      logger.error(
        'MULTIPLAYER',
        `Failed to connect to multiplayer server (${errorType}): ${errorMessage}`
      );

      // Show error message and stop the game - no local fallback
      this.showConnectionFailureMessage(errorType, 'Cannot connect');
      throw new Error(`Multiplayer connection failed: ${errorMessage}`);
    }

    // Always initialize multiplayer systems - assume multiplayer by default
    this.multiplayerManager.initializeAsteroidSync();

    // Create an empty asteroid belt - server will populate with authoritative asteroids
    this.currRoidBelt = entityFactory.createEmptyRoidBelt();
    this.multiplayerManager.setAsteroidBelt(this.currRoidBelt);

    // Initialize listeners and bots
    const localPlayer = this.playerManager.getLocalPlayer();
    this.inputManager.initializeListeners(localPlayer);
    this.playerManager.setupBotShootHandler();

    // Initialize bots once when the game starts
    this.playerManager.initializeBots();

    // Set up server asteroid event listeners
    this.setupServerAsteroidListeners();

    window.dispatchEvent(new CustomEvent('gameStart'));
  }

  // Event handler methods for server asteroid synchronization
  private handleServerAsteroidCreated = (event: Event): void => {
    const customEvent = event as CustomEvent<{ asteroid: AsteroidData }>;
    const { asteroid } = customEvent.detail;
    logger.debug('GAME', 'Adding server asteroid to local belt', { asteroidId: asteroid.id });

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
  };

  private handleServerAsteroidUpdated = (event: Event): void => {
    const customEvent = event as CustomEvent<{
      asteroidId: string;
      updates: Partial<AsteroidData>;
    }>;
    const { asteroidId, updates } = customEvent.detail;
    logger.debug('GAME', 'Updating server asteroid in local belt', { asteroidId });

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
  };

  private handleServerAsteroidDestroyed = (event: Event): void => {
    const customEvent = event as CustomEvent<{ asteroidId: string }>;
    const { asteroidId } = customEvent.detail;
    logger.debug('GAME', 'Removing server asteroid from local belt', { asteroidId });

    // Remove the asteroid from the local belt
    if (this.currRoidBelt) {
      const index = this.currRoidBelt.roids.findIndex((r) => r.id === asteroidId);
      if (index !== -1) {
        this.currRoidBelt.roids.splice(index, 1);
      }
    }
  };

  private setupServerAsteroidListeners(): void {
    // Listen for server asteroid creation events
    window.addEventListener('serverAsteroidCreated', this.handleServerAsteroidCreated);

    // Listen for server asteroid update events
    window.addEventListener('serverAsteroidUpdated', this.handleServerAsteroidUpdated);

    // Listen for server asteroid destruction events
    window.addEventListener('serverAsteroidDestroyed', this.handleServerAsteroidDestroyed);
  }

  private cleanupServerAsteroidListeners(): void {
    // Remove all server asteroid event listeners
    window.removeEventListener('serverAsteroidCreated', this.handleServerAsteroidCreated);
    window.removeEventListener('serverAsteroidUpdated', this.handleServerAsteroidUpdated);
    window.removeEventListener('serverAsteroidDestroyed', this.handleServerAsteroidDestroyed);
  }

  gameOver(deathCause?: string): void {
    const gameOverText = deathCause ? `Game Over: You were killed by ${deathCause}` : 'Game Over';
    this.gameStateManager.updateTextProperties(gameOverText, 1.0);

    // Clean up server asteroid listeners to prevent memory leaks
    this.cleanupServerAsteroidListeners();

    // Don't stop the game loop yet - let the text render for a few seconds
    setTimeout(() => {
      // Stop the game loop and return to main menu
      this.gameStateManager.toggleIsGameRunning();
      import('../ui/mainMenu').then(({ showGameOverMenu }) => {
        showGameOverMenu();
      });
    }, 3500); // Increased time to read the death message
  }

  private setupGameOverHandler(): void {
    // Listen for player death events (both life loss and game over)
    window.addEventListener('playerDied', (event) => {
      const customEvent = event as CustomEvent<{
        playerId: string;
        deathCause: string;
        isGameOver: boolean;
      }>;

      // Only handle events for local player
      const localPlayer = this.playerManager.getLocalPlayer();
      if (customEvent.detail.playerId === localPlayer?.id) {
        const { deathCause, isGameOver } = customEvent.detail;

        if (isGameOver) {
          // Final death - show game over message
          logger.info('GAME', `Game over - killed by: ${deathCause}`);
          this.gameOver(deathCause);
        } else {
          // Life loss - death message is handled by GameLoopManager during respawn
          logger.info('GAME', `Life lost - killed by: ${deathCause}`);
        }
      } else {
        // Handle other player deaths - check if local player killed them
        const { deathCause } = customEvent.detail;
        if (deathCause.includes('laser') && deathCause.includes(localPlayer?.name || '')) {
          // Extract the killed player's name from the death cause
          // The death cause format is typically "PlayerName's laser" or similar
          const deathCauseText = deathCause.toLowerCase();
          const localPlayerName = localPlayer?.name.toLowerCase() || '';

          // Check if this death was caused by the local player's laser
          if (deathCauseText.includes(localPlayerName) && deathCauseText.includes('laser')) {
            // Get the killed player's name from the event
            const killedPlayerId = customEvent.detail.playerId;

            // Try to find the player in the multiplayer manager (remote players and bots)
            const multiplayerManager = this.multiplayerManager;
            const remotePlayers = multiplayerManager.getRemotePlayers();
            const botPlayers = this.playerManager.getBots();

            // Check remote players first
            let killedPlayer = remotePlayers.find((p) => p.id === killedPlayerId);

            // If not found in remote players, check bots
            if (!killedPlayer) {
              killedPlayer = botPlayers.get(killedPlayerId);
            }

            if (killedPlayer) {
              this.setKillMessage(killedPlayer.name);
            }
          }
        }
      }
    });

    // Keep the old game over handler for backward compatibility
    window.addEventListener('playerGameOver', (event) => {
      const customEvent = event as CustomEvent<{
        playerId: string;
        deathCause: string;
      }>;

      // Only handle game over for local player
      const localPlayer = this.playerManager.getLocalPlayer();
      if (customEvent.detail.playerId === localPlayer?.id) {
        logger.info('GAME', `Game over - killed by: ${customEvent.detail.deathCause}`);
        this.gameOver(customEvent.detail.deathCause);
      }
    });

    // Listen for remote player deaths
    window.addEventListener('remotePlayerDied', (event) => {
      const customEvent = event as CustomEvent<{
        playerId: string;
        playerName: string;
        deathCause: string;
      }>;

      // Set kill message for remote player death
      this.setKillMessage(customEvent.detail.playerName);

      logger.debug('GAME', 'Remote player killed', {
        playerId: customEvent.detail.playerId,
        playerName: customEvent.detail.playerName,
        deathCause: customEvent.detail.deathCause,
      });
    });
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

  // Kill message methods
  setKillMessage(playerName: string): void {
    this.gameStateManager.setKillMessage(playerName);
  }

  updateKillMessageTimer(): void {
    this.gameStateManager.updateKillMessageTimer();
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

  // Connection error handling methods
  private categorizeConnectionError(
    error: unknown
  ): 'network' | 'timeout' | 'auth' | 'server' | 'unknown' {
    if (!(error instanceof Error)) {
      return 'unknown';
    }

    const message = error.message.toLowerCase();
    const code = (error as { code?: string }).code;

    // Network unreachable errors
    if (
      code === 'ENOTFOUND' ||
      code === 'ECONNREFUSED' ||
      code === 'EHOSTUNREACH' ||
      code === 'ENETUNREACH' ||
      message.includes('network') ||
      message.includes('unreachable')
    ) {
      return 'network';
    }

    // Timeout errors
    if (code === 'ETIMEDOUT' || code === 'ECONNABORTED' || message.includes('timeout')) {
      return 'timeout';
    }

    // Authentication/permission errors
    if (
      code === 'EAUTH' ||
      code === 'EPERM' ||
      message.includes('auth') ||
      message.includes('permission') ||
      message.includes('unauthorized')
    ) {
      return 'auth';
    }

    // Server errors (5xx responses, internal server errors)
    if (code === 'ESERVER' || message.includes('server') || message.includes('internal')) {
      return 'server';
    }

    return 'unknown';
  }

  private showConnectionFailureMessage(errorType: string, reason: string): void {
    let message = '';

    switch (errorType) {
      case 'network':
        message = `Network connection failed. ${reason}.`;
        break;
      case 'timeout':
        message = `Connection timed out. ${reason}.`;
        break;
      case 'auth':
        message = `Authentication failed. Please check your credentials.`;
        break;
      case 'server':
        message = `Server error occurred. ${reason}.`;
        break;
      default:
        message = `Connection failed: ${reason}.`;
    }

    // Show user feedback - could be enhanced with toast/modal system
    logger.warn('MULTIPLAYER', message);
    // TODO: Implement proper UI feedback (toast/modal with retry button)
    // this.uiManager.showToast(message, { action: 'Retry', onAction: () => this.retryConnection() });
  }

  private setupMultiplayerDisconnectionHandler(): void {
    // Listen for multiplayer disconnection events
    window.addEventListener('multiplayerDisconnected', (event) => {
      const customEvent = event as CustomEvent<{ reason: string }>;
      logger.warn(
        'MULTIPLAYER',
        `Multiplayer disconnected: ${customEvent.detail.reason} - attempting reconnection`
      );

      // Don't stop the game immediately - let the MultiplayerManager handle reconnection
      // The game continues running while reconnection attempts are made
    });

    // Listen for successful reconnection
    window.addEventListener('multiplayerReconnected', () => {
      logger.info('MULTIPLAYER', 'Successfully reconnected to server - game continues');
      // Game continues running normally - no action needed
    });

    // Listen for permanent disconnection (after all reconnection attempts fail)
    window.addEventListener('multiplayerPermanentlyDisconnected', (event) => {
      const customEvent = event as CustomEvent<{ reason: string }>;
      logger.error(
        'MULTIPLAYER',
        `Permanently disconnected: ${customEvent.detail.reason} - stopping game`
      );

      // Only stop the game when reconnection has permanently failed
      this.gameStateManager.toggleIsGameRunning();
      toggleScreen('gameArea', false);
      toggleScreen('start-screen', true);

      // Show permanent disconnection message
      this.showConnectionFailureMessage('network', 'Connection permanently lost');
    });
  }
}
