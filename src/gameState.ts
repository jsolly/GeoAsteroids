import {
  STARTING_SCORE,
  START_LEVEL,
  NEXT_LEVEL_POINTS,
  SAVE_KEY_PERSONAL_BEST,
} from './constants';

interface IGameState {
  getCurrentScore(): number;
  updateCurrentScore(points: number): void;
  resetCurrentScore(): void;
  resetCurrentLevel(): void;
  getCurrentLevel(): number;
  updateCurrentLevel(): void;
  getNextLevel(): number;
  updateNextLevel(): void;
  getPersonalBest(): number;
  updatePersonalBest(): void;
}

class GameState implements IGameState {
  private static instance: GameState;
  private currentScore = STARTING_SCORE;
  private currentLevel = START_LEVEL;
  private nextLevel = NEXT_LEVEL_POINTS;

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

  getNextLevel(): number {
    return this.nextLevel;
  }

  updateNextLevel(): void {
    this.nextLevel += NEXT_LEVEL_POINTS;
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
}

export { GameState };
