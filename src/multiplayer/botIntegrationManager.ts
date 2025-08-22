import { BotManager } from '../entities/bot/botManager';
import type { BotShoot } from '../entities/bot/types';
import type { Vector } from '../physics/Vector';

export class BotIntegrationManager {
  private botManager: BotManager;

  constructor() {
    this.botManager = BotManager.getInstance();

    // Set up bot shooting callback
    this.botManager.setBotShootCallback((botShoot: BotShoot) => {
      this.handleBotShoot(botShoot);
    });
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

  public updateLocalPlayerForBots(position: Vector, alive: boolean): void {
    this.botManager.updateLocalPlayerPosition(position, alive);
  }

  private handleBotShoot(botShoot: BotShoot): void {
    // Handle bot shooting - this will be processed by the game controller

    // Emit a custom event that the game controller can listen to
    window.dispatchEvent(
      new CustomEvent('botShoot', {
        detail: botShoot,
      })
    );
  }
}
