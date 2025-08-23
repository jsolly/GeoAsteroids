import { BotManager } from '../entities/bot/botManager';
import type { Position } from '../entities/player/types';

export class BotIntegrationManager {
  private botManager: BotManager;

  constructor() {
    this.botManager = BotManager.getInstance();
    // No need for callbacks anymore - bots manage their own lasers directly
  }

  // Public getter for direct access to botManager
  public get manager(): BotManager {
    return this.botManager;
  }

  public enableBots(count: number): void {
    this.botManager.activate();
    this.botManager.createBots(count);
  }

  public disableBots(): void {
    this.botManager.deactivate();
    this.botManager.clearBotLasers();
  }

  public updateLocalPlayerForBots(position: Position, alive: boolean): void {
    this.botManager.updateLocalPlayerPosition(position, alive);
  }
}
