export class GameStateManager {
  private static instance: GameStateManager;
  private currentScore = 0;
  private textAlpha = 1;
  private text = '';
  private isGameRunning = false;

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
  }

  updateTextAlpha(alpha: number): void {
    this.textAlpha = alpha;
  }
}
