import { MultiplayerManager } from '../multiplayer/multiplayerManager';
import { DebugBotIntegrationManager } from './debugBotIntegrationManager';

export class DebugMultiplayerManager {
  private multiplayerManager: MultiplayerManager;
  private debugBotIntegration: DebugBotIntegrationManager;

  constructor() {
    this.multiplayerManager = MultiplayerManager.getInstance();
    this.debugBotIntegration = new DebugBotIntegrationManager();
  }

  public disableBotMovement(): void {
    this.debugBotIntegration.disableBotMovement();
  }

  public enableBotMovement(): void {
    this.debugBotIntegration.enableBotMovement();
  }

  public isBotMovementDisabled(): boolean {
    return this.debugBotIntegration.isBotMovementDisabled();
  }

  // Delegate other methods to the original multiplayer manager
  public getBots() {
    return this.multiplayerManager.getBots();
  }

  public enableBots(count: number): void {
    // Use our debug bot integration manager instead of the original
    this.debugBotIntegration.enableBots(count);
  }

  public disableBots(): void {
    // Use our debug bot integration manager instead of the original
    this.debugBotIntegration.disableBots();
  }

  public connect(): void {
    this.multiplayerManager.connect();
  }

  public isConnected(): boolean {
    return this.multiplayerManager.isConnected;
  }
}
