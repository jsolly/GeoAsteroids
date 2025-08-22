import { GameState } from '../core/gameState';

export class DebugGameState {
  private gameState: GameState;
  private debugMode = false;

  constructor() {
    this.gameState = GameState.getInstance();
  }

  // Debug methods
  isDebugMode(): boolean {
    return this.debugMode;
  }

  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }

  // Delegate other methods to the original game state
  getCurrentScore(): number {
    return this.gameState.getCurrentScore();
  }

  updateCurrentScore(points: number): void {
    this.gameState.updateCurrentScore(points);
  }

  isMultiplayerEnabled(): boolean {
    return this.gameState.isMultiplayerEnabled();
  }

  setMultiplayerEnabled(enabled: boolean): void {
    this.gameState.setMultiplayerEnabled(enabled);
  }
}
