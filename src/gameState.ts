import { STARTING_SCORE, START_LEVEL } from './config';

interface IGameState {
  getCurrentScore(): number;
  updateCurrentScore(points: number): void;
  resetCurrentScore(): void;
  resetCurrentLevel(): void;
  getCurrentLevel(): number;
  updateCurrentLevel(): void;
}

class GameState implements IGameState {
  private static instance: GameState;
  private currentScore = STARTING_SCORE;
  private currentLevel = START_LEVEL;

  // eslint-disable-next-line @typescript-eslint/no-empty-function
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
}

export { GameState };
