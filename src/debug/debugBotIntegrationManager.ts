import { BotIntegrationManager } from '../multiplayer/botIntegrationManager.ts';

export class DebugBotIntegrationManager extends BotIntegrationManager {
  private botMovementDisabled = false;

  public disableBotMovement(): void {
    this.botMovementDisabled = true;
    // Get the bot manager and disable movement for all bots
    const botManager = this.manager;
    if (botManager) {
      // Access the bot movement system through the bot manager
      const botMovement = (botManager as any).botMovement;
      if (botMovement) {
        botMovement.debugMovementDisabled = true;
      }
    }
  }

  public enableBotMovement(): void {
    this.botMovementDisabled = false;
    const botManager = this.manager;
    if (botManager) {
      const botMovement = (botManager as any).botMovement;
      if (botMovement) {
        botMovement.debugMovementDisabled = false;
      }
    }
  }

  public isBotMovementDisabled(): boolean {
    return this.botMovementDisabled;
  }
}
