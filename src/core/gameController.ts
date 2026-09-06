import type { AsteroidData } from '../../shared-types';
import { bindGameAudio } from '../audio/spatialAudio';
import { entityFactory } from '../entities/EntityFactory';
import { PlayerManager } from '../entities/player/PlayerManager';
import { PlayerNetwork } from '../entities/player/playerNetwork';
import { advanceRemotePlayerLasers } from '../entities/player/remoteLasers';
import type { RoidBelt } from '../entities/roid/Roid';
import { NetworkManager } from '../network/networkManager';
import { CollisionManager } from '../physics/collision/CollisionManager';
import { canvasManager } from '../rendering/canvas';
import { toggleScreen } from '../ui/uiUtils';
import { logger } from '../utils/Logger';
import { GameStateManager } from './services/GameStateManager';
import { InputManager } from './services/InputManager';

export class GameController {
  private static instance: GameController;

  private gameStateManager: GameStateManager;
  private playerManager: PlayerManager;
  private inputManager: InputManager;
  private networkManager: NetworkManager;
  private collisionManager: CollisionManager;

  private currRoidBelt: RoidBelt;

  private constructor() {
    this.gameStateManager = GameStateManager.getInstance();
    this.playerManager = PlayerManager.getInstance();
    this.inputManager = InputManager.getInstance();
    this.networkManager = NetworkManager.getInstance();
    this.collisionManager = CollisionManager.getInstance();

    bindGameAudio({
      getListenerPosition: () => this.playerManager.getLocalShip()?.position,
      getViewport: () => {
        const canvas = canvasManager.getCanvas();
        if (!canvas) {
          return undefined;
        }
        return { width: canvas.width, height: canvas.height };
      },
    });

    // Initialize with empty asteroid belt - will be populated by server
    this.currRoidBelt = entityFactory.createEmptyRoidBelt();

    // Set up network disconnection handler
    this.setupNetworkDisconnectionHandler();

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
  newGame(playerName?: string): void {
    // Create new player
    this.playerManager.createLocalPlayer();

    // Set the player name if provided
    if (playerName) {
      this.playerManager.setPlayerName(playerName);
    }

    // Note: Asteroid belt creation is now handled in startGame() to support server-authoritative mode
  }

  async startGame(playerName?: string): Promise<void> {
    logger.debug('GAME_CONTROLLER', 'startGame called', { playerName });
    this.newGame(playerName);
    toggleScreen('start-screen', false);
    toggleScreen('gameArea', true);
    this.gameStateManager.toggleIsGameRunning();

    // Reset button text to default state
    this.inputManager.resetButtonText();

    // Try to connect to network first
    try {
      await this.networkManager.connect();

      // Add a small delay to ensure WebSocket state is fully established
      await new Promise((resolve) => setTimeout(resolve, 100));

      logger.debug('NETWORK', 'Connected to server, using server-authoritative game state');
    } catch (error) {
      // Connection failed - this is a fatal error since we only support networked play
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorType = this.categorizeConnectionError(error);

      logger.error('NETWORK', `Failed to connect to game server (${errorType}): ${errorMessage}`);

      // Show error message and stop the game - no local fallback
      this.showConnectionFailureMessage(errorType, 'Cannot connect');
      throw new Error(`Network connection failed: ${errorMessage}`);
    }
    this.networkManager.initializeAsteroidSync();

    // Create an empty asteroid belt - server will populate with authoritative asteroids
    this.currRoidBelt = entityFactory.createEmptyRoidBelt();

    // Initialize listeners
    if (this.playerManager.getLocalPlayer()) {
      logger.debug('GAME_CONTROLLER', 'Initializing input listeners');
      this.inputManager.initializeListeners();
    } else {
      logger.warn('GAME_CONTROLLER', 'No local player found, cannot initialize input listeners');
    }

    // Set up server asteroid event listeners
    this.setupServerAsteroidListeners();

    // Begin sending continuous local player updates to server
    PlayerNetwork.getInstance().startNetworkUpdates();

    window.dispatchEvent(new CustomEvent('gameStart'));
  }

  // Event handler methods for server asteroid synchronization
  private handleServerAsteroidCreated = (event: Event): void => {
    const customEvent = event as CustomEvent<{ asteroid: AsteroidData }>;
    const { asteroid } = customEvent.detail;
    logger.debug('GAME', 'Adding server asteroid to local belt', { asteroidId: asteroid.id });

    // Clear local asteroids only once when receiving the first server asteroid (server-authoritative)
    if (
      this.currRoidBelt &&
      this.currRoidBelt.roids.length > 0 &&
      !this.currRoidBelt.roids.some((r) => r.id.startsWith('server-asteroid-'))
    ) {
      logger.debug('GAME', 'Clearing local asteroids, server is authoritative', {
        localAsteroidCount: this.currRoidBelt.roids.length,
      });
      this.currRoidBelt.roids.length = 0;
    }

    // Check if asteroid already exists to prevent duplicates
    if (this.currRoidBelt) {
      const existingRoid = this.currRoidBelt.roids.find((r) => r.id === asteroid.id);
      if (existingRoid) {
        return; // Skip duplicate
      }
    }

    // Create a proper Roid object from server data with server ID
    const roid = entityFactory.createRoid({
      position: asteroid.position,
      size: asteroid.size,
      id: asteroid.id,
    });

    // Override properties with server data
    roid.velocity = asteroid.velocity;
    roid.angle = asteroid.rotation;
    roid.angularVelocity = asteroid.angularVelocity;
    roid.health = asteroid.health;
    roid.maxHealth = asteroid.maxHealth;

    // Override shape properties to match server exactly
    roid.jaggedness = asteroid.jaggedness;
    roid.vertices = asteroid.vertices;
    roid.offsets.length = 0; // Clear existing offsets
    roid.offsets.push(...asteroid.offsets); // Copy server offsets

    // Add to current asteroid belt if it exists
    if (this.currRoidBelt) {
      this.currRoidBelt.roids.push(roid);
      logger.info(
        'GAME',
        `Added asteroid ${asteroid.id} to belt. Total asteroids: ${this.currRoidBelt.roids.length}`
      );
    } else {
      logger.error('GAME', 'No asteroid belt available for adding asteroid');
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
        const roid = this.currRoidBelt.roids[index];
        if (roid !== undefined) {
          // Clear pending destruction flag before removing
          roid.pendingDestruction = false;
          this.currRoidBelt.roids.splice(index, 1);
        }
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
      this.gameStateManager.setIsGameRunning(false);
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

            // Try to find the player in the network manager (remote players only)
            const networkManager = this.networkManager;
            const remotePlayers = networkManager.getRemotePlayers();

            // Check remote players
            const killedPlayer = remotePlayers.find((p) => p.id === killedPlayerId);

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

  // Score management — the server is authoritative; the local player's entity
  // score is synced from the server's gameState broadcast.
  getCurrScore(): number {
    return this.playerManager.getLocalPlayer()?.score ?? 0;
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

  // Network methods
  setPlayerName(name: string): void {
    this.playerManager.setPlayerName(name);
  }

  updateNetworkPlayerState(): void {
    this.playerManager.updateNetworkState();
  }

  getNetworkManager(): NetworkManager {
    return this.networkManager;
  }

  // Getters for service access (for backward compatibility and testing)
  getGameStateManager(): GameStateManager {
    return this.gameStateManager;
  }

  getPlayerManager(): PlayerManager {
    return this.playerManager;
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
    logger.warn('NETWORK', message);
    // TODO: Implement proper UI feedback (toast/modal with retry button)
    // this.uiManager.showToast(message, { action: 'Retry', onAction: () => this.retryConnection() });
  }

  private setupNetworkDisconnectionHandler(): void {
    // Listen for network disconnection events
    window.addEventListener('networkDisconnected', (event) => {
      const customEvent = event as CustomEvent<{ reason: string }>;
      logger.warn(
        'NETWORK',
        `Network disconnected: ${customEvent.detail.reason} - attempting reconnection`
      );

      // Don't stop the game immediately - let the NetworkManager handle reconnection
      // The game continues running while reconnection attempts are made
    });

    // Listen for successful reconnection
    window.addEventListener('networkReconnected', () => {
      logger.info('NETWORK', 'Successfully reconnected to server - game continues');
      // Game continues running normally - no action needed
    });

    // Listen for permanent disconnection (after all reconnection attempts fail)
    window.addEventListener('networkPermanentlyDisconnected', (event) => {
      const customEvent = event as CustomEvent<{ reason: string }>;
      logger.error(
        'NETWORK',
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

  // Update game state (movement, physics, etc.)
  updateGame(): void {
    const currPlayer = this.playerManager.getLocalPlayer();
    if (!currPlayer) {
      return;
    }

    // Update local player ship
    logger.debug('GAME_LOOP', 'Updating ship', {
      shipPosition: currPlayer.ship.position,
      shipAngle: currPlayer.ship.angle,
    });
    currPlayer.ship.update();

    // Update all bot ships
    const allPlayers = this.networkManager.getAllPlayers();
    const botPlayers = allPlayers.filter((player) => player.type === 'bot');
    for (const botPlayer of botPlayers) {
      if (botPlayer.ship) {
        botPlayer.ship.update();
      }
    }

    // Remote human ships are server-driven and never run Ship.update(); advance
    // their lasers so other players' shots visibly travel and expire instead of
    // freezing at the muzzle.
    advanceRemotePlayerLasers(allPlayers);

    // Update asteroids
    if (this.currRoidBelt) {
      this.currRoidBelt.moveRoids();
    }

    // Check laser collisions with asteroids and bots
    this.checkLaserCollisions();

    // Check ship collisions with asteroids
    this.checkShipAsteroidCollisions();

    // Check ship collisions with other ships
    this.checkShipShipCollisions();

    // Check bot collisions with asteroids
    this.checkBotAsteroidCollisions();

    // Check boundary collisions for ships
    this.checkBoundaryCollisions();

    // Update game state manager
    this.gameStateManager.updateKillMessageTimer();
  }

  // Check laser collisions with asteroids and bots
  private checkLaserCollisions(): void {
    const currPlayer = this.playerManager.getLocalPlayer();
    if (!currPlayer || !this.currRoidBelt) {
      return;
    }

    // Get all players (including bots) from network manager
    const allPlayers = this.networkManager.getAllPlayers();
    const laserTargets = allPlayers
      .filter((player) => player.type === 'bot' || player.type === 'remote')
      .map((player) => ({
        ship: player.ship,
        id: player.id,
        type: player.type as 'bot' | 'remote',
      }));

    // Attribute kills to the server-assigned player id (set at join time), not
    // currPlayer.id which only becomes the server id once the first gameState
    // reconciles the local player — asteroids can arrive before that.
    const attackerId = this.networkManager.getLocalPlayerId() || currPlayer.id;

    this.collisionManager.checkLaserCollisions(
      currPlayer.ship.lasers,
      this.currRoidBelt.roids,
      laserTargets,
      attackerId
    );

    // Incoming bot lasers use the same hull check. Human shooters already
    // report their own hits; only bots have no shooter client.
    const localTarget = [
      {
        ship: currPlayer.ship,
        id: attackerId,
        type: 'local' as const,
      },
    ];
    for (const player of allPlayers) {
      if (player.type !== 'bot' || !player.ship?.lasers.length) {
        continue;
      }
      this.collisionManager.checkLaserCollisions(player.ship.lasers, [], localTarget, player.id);
    }
  }

  // Check boundary collisions for ships
  private checkBoundaryCollisions(): void {
    const currPlayer = this.playerManager.getLocalPlayer();
    if (!currPlayer) {
      return;
    }

    // Only check the locally-controlled ship. The network player list holds
    // server-synced copies (which lag at 30 FPS) rather than the predicted
    // local ship, and boundary damage is always attributed to the local
    // player. Bots are kept in-bounds server-side; remote players self-report.
    this.collisionManager.checkBoundaryCollisions([currPlayer.ship], currPlayer.id);
  }

  // Check ship collisions with asteroids
  private checkShipAsteroidCollisions(): void {
    const currPlayer = this.playerManager.getLocalPlayer();
    if (!currPlayer || !this.currRoidBelt) {
      return;
    }

    // Check asteroid collisions for local player
    logger.debug('COLLISION', 'Checking ship-asteroid collisions', {
      shipPos: currPlayer.ship.position,
      shipRadius: currPlayer.ship.r,
      asteroidCount: this.currRoidBelt.roids.length,
      localPlayerId: currPlayer.id,
    });
    this.collisionManager.checkPlayerAsteroidCollisions(currPlayer, this.currRoidBelt.roids);
  }

  // Check ship collisions with other ships
  private checkShipShipCollisions(): void {
    const currPlayer = this.playerManager.getLocalPlayer();
    if (!currPlayer) {
      return;
    }

    // Get all players (including bots) from network manager
    const allPlayers = this.networkManager.getAllPlayers();
    const otherShips = allPlayers
      .filter((player) => player.id !== currPlayer.id)
      .map((player) => player.ship);

    // Check ship-to-ship collisions
    this.collisionManager.checkShipShipCollisions(currPlayer.ship, otherShips, currPlayer.id);
  }

  // Check bot collisions with asteroids
  private checkBotAsteroidCollisions(): void {
    if (!this.currRoidBelt) {
      return;
    }

    // Get all players (including bots) from network manager
    const allPlayers = this.networkManager.getAllPlayers();
    const botPlayers = allPlayers.filter((player) => player.type === 'bot');

    // Check asteroid collisions for each bot
    for (const botPlayer of botPlayers) {
      if (botPlayer.ship && !botPlayer.ship.exploding) {
        logger.debug('COLLISION', 'Checking bot-asteroid collisions', {
          botId: botPlayer.id,
          botPos: botPlayer.ship.position,
          botRadius: botPlayer.ship.r,
          asteroidCount: this.currRoidBelt.roids.length,
        });
        this.collisionManager.checkPlayerAsteroidCollisions(botPlayer, this.currRoidBelt.roids);
      }
    }
  }

  // Simple render method - no game logic, just rendering
  renderGame(): void {
    const currPlayer = this.playerManager.getLocalPlayer();
    if (!currPlayer) {
      return;
    }

    // Use NetworkManager's player list which has the correct names from server
    const allPlayers = this.networkManager.getAllPlayers();
    const playersToRender = [...allPlayers];
    if (!playersToRender.includes(currPlayer)) {
      playersToRender.unshift(currPlayer);
    }
    const currScore = currPlayer.score;
    const textAlpha = this.gameStateManager.getTextAlpha();
    const text = this.gameStateManager.getText();

    // Render the current game state
    canvasManager.drawGame(
      currPlayer,
      this.currRoidBelt,
      currScore,
      textAlpha,
      text,
      currPlayer.lives,
      playersToRender
    );
  }
}
