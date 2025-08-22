import { Music } from '../audio/Music.ts';
import { DEFAULT_BOT_COUNT, DRAW_ASTEROIDS, EMP_PULSE_RADIUS } from '../constants';
import { type AsteroidBelt, createAsteroidBelt } from '../entities/asteroid/Asteroid.ts';
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
    this.player = new Player({ id: 'local-player', name: 'LocalPlayer', isBot: false });
    this.currShip = this.player.ship;
    this.currRoidBelt = createAsteroidBelt();
    this.multiplayerManager = MultiplayerManager.getInstance();

    // Expose multiplayer testing commands to browser console
    MultiplayerManager.exposeToWindow();

    // Set up EMP pulse event listener
    this.setupEmpPulseHandler();

    // Expose game controller globally for testing
    if (typeof window !== 'undefined') {
      (window as { gameController?: GameController }).gameController = this;
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
    this.player = new Player({ id: 'local-player', name: 'LocalPlayer', isBot: false });
    this.currShip = this.player.ship;
    this.currRoidBelt = createAsteroidBelt();
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

    // Always enable multiplayer mode
    this.enableMultiplayer();

    // Connect to multiplayer and adjust asteroids once connected
    this.multiplayerManager
      .connect()
      .then(() => {
        if (this.currRoidBelt) {
          this.currRoidBelt.adjustForMultiplayer();
        }
      })
      .catch((error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn('Failed to connect to multiplayer, continuing with local game:', errorMessage);
      });

    window.dispatchEvent(new CustomEvent('gameStart'));
  }

  gameOver(): void {
    this.updateTextProperties('Game Over', 1.0);
    this.music.setMusicTempo(1.0);

    // Don't stop the game loop yet - let the text render for a few seconds
    // The text will fade out over TEXT_FADE_TIME (2.5 seconds)
    // Then we'll return to main menu
    setTimeout(() => {
      // Stop the game loop and return to main menu
      this.toggleIsGameRunning();
      import('../ui/mainMenu.ts').then(({ showGameOverMenu }) => {
        showGameOverMenu();
      });
    }, 2500); // Wait for text to fade out completely
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
    const multiplayerBtn = document.getElementById('start-multiplayer') as HTMLButtonElement;

    if (multiplayerBtn) {
      multiplayerBtn.innerText = '🌐 Start Multiplayer Game';
    }
  }

  // Multiplayer methods
  enableMultiplayer(): void {
    this.gameState.setMultiplayerEnabled(true);

    // Always enable bots for multiplayer mode, regardless of websocket status
    // Bots work independently of websocket connections
    this.enableBots(DEFAULT_BOT_COUNT); // Add default bots immediately at game start
  }

  // Method to set player name for multiplayer
  setPlayerName(name: string): void {
    this.multiplayerManager.setLocalPlayerName(name);
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
  enableBots(count: number): void {
    if (this.gameState.isMultiplayerEnabled()) {
      this.multiplayerManager.enableBots(count);
    }
  }

  disableBots(): void {
    if (this.gameState.isMultiplayerEnabled()) {
      this.multiplayerManager.disableBots();
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
  }

  private handleBotShoot(botShoot: BotShoot): void {
    // Check if the bot shot hits the player
    if (this.checkBotLaserHit(botShoot)) {
      // Check if ship is invincible (blinking)
      if (this.currShip.blinkCount > 0 || this.currShip.exploding) {
        return; // No damage taken
      }

      // Damage the player using the damage system instead of bypassing it
      this.currShip.takeDamage(15); // Bot laser damage

      // The takeDamage method will handle life loss and respawn
      // We don't need to manually manage lives or call die() here
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
    if (!DRAW_ASTEROIDS) {
      return;
    }
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
    if (!this.gameState.isMultiplayerEnabled()) {
      return;
    }

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
      this.multiplayerManager.empDestroyBot(botId);

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
}

export { GameController };
