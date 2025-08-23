import { DebugGameController } from './debugGameController';
import { DebugGameState } from './debugGameState';

export class DebugManager {
  private static instance: DebugManager;
  private debugGameController: DebugGameController;
  private debugGameState: DebugGameState;

  private constructor() {
    this.debugGameController = new DebugGameController();
    this.debugGameState = new DebugGameState();
  }

  public static getInstance(): DebugManager {
    if (!DebugManager.instance) {
      DebugManager.instance = new DebugManager();
    }
    return DebugManager.instance;
  }

  public enableDebugMode(): void {
    // Set debug mode in game state
    this.debugGameState.setDebugMode(true);

    // Enable debug mode in game controller
    this.debugGameController.enableDebugMode();
  }

  public disableDebugMode(): void {
    this.debugGameState.setDebugMode(false);
  }

  public isDebugMode(): boolean {
    return this.debugGameState.isDebugMode();
  }

  public getDebugGameController(): DebugGameController {
    return this.debugGameController;
  }

  public getDebugGameState(): DebugGameState {
    return this.debugGameState;
  }

  public getDebugConfig() {
    return this.debugGameController.getDebugConfig();
  }
}
