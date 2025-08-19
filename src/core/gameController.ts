import { Music } from '../audio/Music.ts';
import { DRAW_ASTEROIDS, EMP_PULSE_RADIUS } from '../constants';
import { AsteroidBelt } from '../entities/asteroid/Asteroid.ts';
import type { BotPlayer, BotShoot } from '../entities/bot/types.ts';
import { Player } from '../entities/player/index.ts';
import type { Ship } from '../entities/ship/Ship.ts';
import { keyDown, keyUp } from '../input/keybindings.ts';
import { MultiplayerManager } from '../multiplayer/multiplayerManager.ts';
import { Vector } from '../physics/Vector.ts';
import { toggleScreen } from '../ui/uiUtils.ts';
import { GameState } from './gameState.ts';

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
  tickMusic(): void;
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
  private music: Music;
  private currShip: Ship;
  private player: Player;
  private currRoidBelt: AsteroidBelt;
  private multiplayerManager: MultiplayerManager;
  private botShootHandler?: (event: CustomEvent) => void;

  private constructor() {
    this.gameState = GameState.getInstance();
    this.music = new Music('sounds/music-low.m4a', 'sounds/music-high.m4a');
    // Create player (it will create its own ship)
    this.player = new Player('local-player', 'LocalPlayer', 3, false);
    this.currShip = this.player.ship;
    this.currRoidBelt = new AsteroidBelt();
    this.multiplayerManager = MultiplayerManager.getInstance();

    // Expose multiplayer testing commands to browser console
    MultiplayerManager.exposeToWindow();

    // Set up EMP pulse event listener
    this.setupEmpPulseHandler();

    // Expose game controller globally for testing
    if (typeof window !== 'undefined') {
      (window as { gameController?: GameController }).gameController = this;
      console.info('GAME_CONTROLLER', 'Game controller exposed globally for testing');
    }
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
    this.music.setMusicTempo(1.0 + this.gameState.getCurrentLevel() / 10);
  }

  newGame(): void {
    this.gameState.resetCurrentScore();
    this.gameState.resetCurrentLevel();
    // Create player (it will create its own ship)
    this.player = new Player('local-player', 'LocalPlayer', 3, false);
    this.currShip = this.player.ship;
    this.currRoidBelt = new AsteroidBelt();
    this.music.setMusicTempo(1.0);
  }

  startGame(): void {
    this.newGame();
    toggleScreen('start-screen', false);
    toggleScreen('gameArea', true);
    this.toggleIsGameRunning();
    initializeListeners(() => this.getIsGameRunning());

    // Reset button text to default state
    this.resetButtonText();

    if (this.gameState.isMultiplayerEnabled()) {
      this.multiplayerManager.connect();
      setTimeout(() => {
        this.currRoidBelt.adjustForMultiplayer();
      }, 100);
    }

    window.dispatchEvent(new CustomEvent('gameStart'));
  }

  gameOver(): void {
    this.currShip.explode();
    this.updateTextProperties('Game Over', 1.0);
    this.music.setMusicTempo(1.0);
  }

  tickMusic(): void {
    this.music.tick();
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
    const startGameBtn = document.getElementById('start-single-player') as HTMLButtonElement;
    const multiplayerBtn = document.getElementById('start-multiplayer') as HTMLButtonElement;

    if (startGameBtn && multiplayerBtn) {
      startGameBtn.innerText = '🎮 Single Player';
      multiplayerBtn.innerText = '🌐 Multiplayer';
    }
  }

  // Multiplayer methods
  enableMultiplayer(): void {
    this.gameState.setMultiplayerEnabled(true);

    // Always enable bots for multiplayer mode, regardless of websocket status
    // Bots work independently of websocket connections
    this.enableBots(3); // Add 3 bots immediately at game start

    // Adjust asteroids for multiplayer
    setTimeout(() => {
      this.currRoidBelt.adjustForMultiplayer();
    }, 100);
  }

  // Method to set player name for multiplayer
  setPlayerName(name: string): void {
    this.multiplayerManager.setLocalPlayerName(name);
    console.info('GAME_CONTROLLER', 'Player name set', { name });
  }

  disableMultiplayer(): void {
    this.gameState.setMultiplayerEnabled(false);
    this.multiplayerManager.disconnect();

    // Reset asteroids to normal count
    setTimeout(() => {
      this.currRoidBelt.adjustForMultiplayer();
    }, 100);
  }

  isMultiplayerEnabled(): boolean {
    return this.gameState.isMultiplayerEnabled();
  }

  getPlayerCount(): number {
    return this.multiplayerManager.players.size;
  }

  updateMultiplayerPlayerState(): void {
    if (this.gameState.isMultiplayerEnabled() && this.multiplayerManager.isConnected) {
      this.multiplayerManager.updatePlayerState({
        position: this.currShip.position,
        velocity: this.currShip.velocity,
        r: this.currShip.r,
        a: this.currShip.a,
        lives: this.player.lives,
        score: this.gameState.getCurrentScore(),
        exploding: this.currShip.exploding,
      });

      // Update bot manager with local player position
      this.multiplayerManager.updateLocalPlayerForBots(this.currShip.position, !this.player.isDead);
    }
  }

  // Bot management methods
  enableBots(count: number = 3): void {
    if (this.gameState.isMultiplayerEnabled()) {
      this.multiplayerManager.enableBots(count);
      console.info('GAME_CONTROLLER', 'Bots enabled', { count });
    } else {
      console.info('GAME_CONTROLLER', 'Cannot enable bots - multiplayer not enabled');
    }
  }

  disableBots(): void {
    if (this.gameState.isMultiplayerEnabled()) {
      this.multiplayerManager.disableBots();
      console.info('GAME_CONTROLLER', 'Bots disabled');
    }
  }

  getBots(): Map<string, BotPlayer> {
    if (this.gameState.isMultiplayerEnabled()) {
      return this.multiplayerManager.getBots();
    }
    return new Map();
  }

  getMultiplayerManager(): MultiplayerManager {
    return this.multiplayerManager;
  }

  // Bot lasers now replace legacy bot bullets. Keep methods for compatibility if needed.

  updateBotsInGameLoop(): void {
    if (this.gameState.isMultiplayerEnabled()) {
      this.multiplayerManager.updateBotsInGameLoop();
    }
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
    console.info('GAME_CONTROLLER', 'Bot shoot handler set up');
  }

  private handleBotShoot(botShoot: BotShoot): void {
    console.info('BOT_SHOOT', 'Bot shoot event received', {
      botId: botShoot.botId,
      shipLives: this.player.lives,
      shipDead: this.player.isDead,
      shipExploding: this.currShip.exploding,
      shipBlinkCount: this.currShip.blinkCount,
    });

    // Check if the bot shot hits the player
    if (this.checkBotLaserHit(botShoot)) {
      // In debug mode, make ship completely invincible to bot lasers
      const isDevelopment =
        (import.meta.env?.DEV === true || import.meta.env?.MODE === 'development') &&
        import.meta.env?.VITE_INVINCIBLE === 'true';
      if (isDevelopment) {
        console.info(
          'BOT_DEBUG_INVINCIBILITY',
          'DEBUG MODE: Bot laser hit but ship is invincible to bot damage',
          {
            botId: botShoot.botId,
            blinkCount: this.currShip.blinkCount,
            exploding: this.currShip.exploding,
          }
        );
        return; // No damage taken in debug mode
      }

      // Check if ship is invincible (blinking)
      if (this.currShip.blinkCount > 0 || this.currShip.exploding) {
        console.info(
          'BOT_INVINCIBILITY',
          'Bot laser hit but ship is invincible - no damage taken',
          {
            botId: botShoot.botId,
            blinkCount: this.currShip.blinkCount,
            exploding: this.currShip.exploding,
          }
        );
        return; // No damage taken
      }

      console.info('BOT_HIT', 'Bot laser hit player - using damage system!', {
        botId: botShoot.botId,
        playerLives: this.player.lives,
        shipHealth: this.currShip.health,
        shipPos: { x: this.currShip.position.x, y: this.currShip.position.y },
        laserStart: botShoot.laserStart,
        laserDirection: botShoot.laserDirection,
        damage: 15,
      });

      // Damage the player using the damage system instead of bypassing it
      this.currShip.takeDamage(15); // Bot laser damage

      // The takeDamage method will handle life loss and respawn
      // We don't need to manually manage lives or call die() here
    } else {
      console.info('BOT_MISS', 'Bot laser missed player');
    }
  }

  private checkBotLaserHit(botShoot: BotShoot): boolean {
    // Simple collision detection between bot laser and player ship
    const laserStart = new Vector(botShoot.laserStart.x, botShoot.laserStart.y);
    const laserDirection = new Vector(botShoot.laserDirection.x, botShoot.laserDirection.y);
    const shipPos = this.currShip.position;
    const shipRadius = this.currShip.r;

    // Calculate distance from laser line to ship center
    const laserEndX = laserStart.x + laserDirection.x * 1000; // Extend laser
    const laserEndY = laserStart.y + laserDirection.y * 1000;

    // Calculate perpendicular distance from point to line
    const A = laserEndY - laserStart.y;
    const B = laserStart.x - laserEndX;
    const C = laserEndX * laserStart.y - laserStart.x * laserEndY;

    const distance = Math.abs(A * shipPos.x + B * shipPos.y + C) / Math.sqrt(A * A + B * B);

    // Debug collision detection
    if (distance <= shipRadius * 2) {
      // Check within 2x radius for debugging
      console.info('BOT_COLLISION_CHECK', 'Bot laser collision check', {
        distance,
        shipRadius,
        threshold: shipRadius,
        hit: distance <= shipRadius,
        shipPos,
        laserStart,
        laserDirection,
      });
    }

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
        debugMode: boolean;
      }>;
      this.handleEmpPulse(empEvent.detail);
    });
    console.info('GAME_CONTROLLER', 'EMP pulse handler set up');
  }

  private handleEmpPulse(detail: {
    shipPosition: { x: number; y: number };
    shipRadius: number;
    debugMode: boolean;
  }): void {
    const { shipPosition, shipRadius, debugMode } = detail;

    console.info('EMP_PULSE', 'EMP pulse activated', {
      shipPosition,
      shipRadius,
      empRadius: EMP_PULSE_RADIUS,
      debugMode,
    });

    // Destroy all asteroids within EMP radius
    this.destroyAsteroidsInRadius(shipPosition, EMP_PULSE_RADIUS);

    // Destroy all bots within EMP radius
    this.destroyBotsInRadius(shipPosition, EMP_PULSE_RADIUS);

    // Add score for destroyed objects (in debug mode, unlimited points)
    if (debugMode) {
      console.info('EMP_DEBUG', 'DEBUG MODE: EMP pulse completed - unlimited usage');
    } else {
      // In normal mode, could add cooldown or limited usage here
      console.info('EMP_NORMAL', 'Normal mode: EMP pulse completed');
    }
  }

  private destroyAsteroidsInRadius(center: { x: number; y: number }, radius: number): void {
    if (!DRAW_ASTEROIDS) {
      return;
    }
    const roids = this.currRoidBelt.roids;
    let destroyedCount = 0;

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
        destroyedCount++;

        console.info('EMP_ASTEROID', 'Asteroid destroyed by EMP', {
          position: roid.position,
          radius: roid.r,
          score,
          distance,
        });
      }
    }

    if (destroyedCount > 0) {
      console.info('EMP_SUMMARY', 'EMP destroyed asteroids', {
        count: destroyedCount,
      });
    }
  }

  private destroyBotsInRadius(center: { x: number; y: number }, radius: number): void {
    if (!this.gameState.isMultiplayerEnabled()) {
      return;
    }

    const bots = this.multiplayerManager.getBots();
    let destroyedCount = 0;

    console.info('EMP_BOT_DETECTION', 'Starting bot detection for EMP pulse', {
      center,
      radius,
      totalBots: bots.size,
      botIds: Array.from(bots.keys()),
    });

    // Collect bot IDs to destroy first, then destroy them
    // This avoids issues with modifying the Map during iteration
    const botsToDestroy: string[] = [];

    for (const [botId, bot] of bots.entries()) {
      const distance = Math.sqrt(
        (bot.ship.position.x - center.x) ** 2 + (bot.ship.position.y - center.y) ** 2
      );

      console.info('EMP_BOT_CHECK', 'Checking bot for EMP destruction', {
        botId,
        botPosition: bot.ship.position,
        distance,
        withinRadius: distance <= radius,
      });

      if (distance <= radius) {
        botsToDestroy.push(botId);

        console.info('EMP_BOT_DETECTED', 'Bot detected for EMP destruction', {
          botId,
          position: bot.ship.position,
          distance,
        });
      }
    }

    console.info('EMP_BOT_SUMMARY', 'Bot detection complete', {
      botsToDestroy,
      count: botsToDestroy.length,
    });

    // Now destroy all detected bots
    for (const botId of botsToDestroy) {
      this.multiplayerManager.empDestroyBot(botId);
      destroyedCount++;

      // Add points for destroying a bot with EMP (same as laser kill)
      this.updateCurrScore(200);

      console.info('EMP_BOT', 'Bot destroyed by EMP', {
        botId,
        scoreAwarded: 200,
      });
    }

    if (destroyedCount > 0) {
      console.info('EMP_SUMMARY', 'EMP destroyed bots', {
        count: destroyedCount,
      });
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
}

export { GameController };
