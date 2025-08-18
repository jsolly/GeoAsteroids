import { BotManager } from '../entities/bot/botManager.ts';
import type { BotShoot } from '../entities/bot/types.ts';
import type { Vector } from '../physics/Vector.ts';

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

  public enableBots(count: number = 3): void {
    console.info('BOT_INTEGRATION', 'Enabling bots', { count });
    this.botManager.activate();
    this.botManager.createBots(count);
  }

  public disableBots(): void {
    this.botManager.deactivate();
    this.botManager.clearBotBullets();
    this.botManager.clearBotLasers();
    console.info('BOT_INTEGRATION', 'Bots disabled and projectiles cleared');
  }

  public updateLocalPlayerForBots(position: Vector, alive: boolean): void {
    this.botManager.updateLocalPlayerPosition(position, alive);
  }

  private handleBotShoot(botShoot: BotShoot): void {
    // Handle bot shooting - this will be processed by the game controller
    console.info('BOT_INTEGRATION', 'Bot shot detected', {
      botId: botShoot.botId,
      targetPlayerId: botShoot.targetPlayerId,
      laserStart: botShoot.laserStart,
      laserDirection: botShoot.laserDirection,
    });

    // Emit a custom event that the game controller can listen to
    window.dispatchEvent(
      new CustomEvent('botShoot', {
        detail: botShoot,
      })
    );
  }
}
