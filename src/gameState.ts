import {
  STARTING_SCORE,
  START_LEVEL,
  NEXT_LEVEL_POINTS,
  SAVE_KEY_PERSONAL_BEST,
} from './constants';

interface IGameState {
  getCurrentScore(): number;
  updateCurrentScore(points: number): void;
  updateNextLevel(): void;
  updateCurrentLevel(): void;
  updatePersonalBest(): void;
  updateTextProperties(text: string, alpha: number): void;
  updateTextAlpha(alpha: number): void;
  toggleIsGameRunning(): void;
  updateText(text: string): void;
  resetCurrentScore(): void;
  resetCurrentLevel(): void;
  getCurrentLevel(): number;
  getNextLevel(): number;
  getPersonalBest(): number;
  getTextAlpha(): number;
  getText(): string;
  getIsGameRunning(): boolean;
}

class GameState implements IGameState {
  private static instance: GameState;
  private currentScore = STARTING_SCORE;
  private currentLevel = START_LEVEL;
  private nextLevel = NEXT_LEVEL_POINTS;
  private textAlpha = 1;
  private text = 'Level 1';
  private isGameRunning = false;

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
    this.currentScore = STARTING_SCORE;
  }

  resetCurrentLevel(): void {
    this.currentLevel = START_LEVEL;
  }

  getCurrentLevel(): number {
    return this.currentLevel;
  }

  updateCurrentLevel(): void {
    this.currentLevel++;
  }

  getNextLevel(): number {
    return this.nextLevel;
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
  updateNextLevel(): void {
    this.nextLevel += NEXT_LEVEL_POINTS;
  }

  updateTextProperties(text: string, alpha: number): void {
    this.text = text;
    this.textAlpha = alpha;
  }

  toggleIsGameRunning(): void {
    this.isGameRunning = !this.isGameRunning;
  }

  getPersonalBest(): number {
    const personalBest = localStorage.getItem(SAVE_KEY_PERSONAL_BEST);
    if (personalBest == null) {
      localStorage.setItem(SAVE_KEY_PERSONAL_BEST, '0');
      return 0;
    }
    return Number(personalBest);
  }

  updatePersonalBest(): void {
    const personalBest = this.getPersonalBest();
    if (this.getCurrentScore() > personalBest) {
      localStorage.setItem(
        SAVE_KEY_PERSONAL_BEST,
        String(this.getCurrentScore()),
      );
    }
  }
  updateTextAlpha(alpha: number): void {
    this.textAlpha = alpha;
  }
  updateText(text: string): void {
    this.text = text;
  }
}

export { GameState };
