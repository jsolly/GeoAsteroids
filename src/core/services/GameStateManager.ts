import { logger } from '../../utils/Logger';

export class GameStateManager {
  private static instance: GameStateManager;
  private currentScore = 0;
  private textAlpha = 1;
  private text = '';
  private isGameRunning = false;

  // Kill message system
  private killMessage = '';
  private killMessageTimer = 0;
  private readonly KILL_MESSAGE_DURATION_FRAMES = 120; // 2 seconds at 60 FPS

  private constructor() {}

  static getInstance(): GameStateManager {
    if (!GameStateManager.instance) {
      GameStateManager.instance = new GameStateManager();
    }
    return GameStateManager.instance;
  }

  getCurrentScore(): number {
    return this.currentScore;
  }

  updateCurrentScore(points: number): void {
    this.currentScore += points;
  }

  resetCurrentScore(): void {
    this.currentScore = 0;
  }

  getTextAlpha(): number {
    return this.textAlpha;
  }

  getText(): string {
    return this.text;
  }

  getIsGameRunning(): boolean {
    return this.isGameRunning;
  }

  updateTextProperties(text: string, alpha: number): void {
    this.text = text;
    this.textAlpha = alpha;
  }

  toggleIsGameRunning(): void {
    this.isGameRunning = !this.isGameRunning;
    logger.debug('GAME_STATE', 'Game state toggled', { isGameRunning: this.isGameRunning });
  }

  updateTextAlpha(alpha: number): void {
    this.textAlpha = alpha;
  }

  // Kill message methods
  setKillMessage(playerName: string): void {
    this.killMessage = `You killed ${playerName}`;
    this.killMessageTimer = this.KILL_MESSAGE_DURATION_FRAMES;
  }

  clearKillMessage(): void {
    this.killMessage = '';
    this.killMessageTimer = 0;
  }

  getKillMessage(): string {
    return this.killMessage;
  }

  hasKillMessage(): boolean {
    return this.killMessageTimer > 0;
  }

  updateKillMessageTimer(): void {
    if (this.killMessageTimer > 0) {
      this.killMessageTimer--;
      if (this.killMessageTimer <= 0) {
        this.killMessage = '';
      }
    }
  }
}
