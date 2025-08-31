import { GAME } from '../constants';

interface GameStateData {
  getCurrentScore(): number;
  updateCurrentScore(points: number): void;
  updateTextProperties(text: string, alpha: number): void;
  updateTextAlpha(alpha: number): void;
  toggleIsGameRunning(): void;
  updateText(text: string): void;
  resetCurrentScore(): void;
  getTextAlpha(): number;
  getText(): string;
  getIsGameRunning(): boolean;
}

class GameState implements GameStateData {
  private static instance: GameState;
  private currentScore = GAME.STARTING_SCORE;
  private textAlpha = 1;
  private text = '';
  private isGameRunning = false;
  // Multiplayer state - always enabled
  public playerCount = 1;

  private constructor() {}

  public static getInstance(): GameState {
    if (!GameState.instance) {
      GameState.instance = new GameState();
    }
    return GameState.instance;
  }

  getCurrentScore(): number {
    return this.currentScore;
  }

  updateCurrentScore(points: number): void {
    this.currentScore += points;
  }

  resetCurrentScore(): void {
    this.currentScore = GAME.STARTING_SCORE;
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
  updateText(text: string): void {
    this.text = text;
  }
}

export { GameState };
