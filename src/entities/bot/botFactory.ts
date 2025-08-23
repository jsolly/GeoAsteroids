import { v4 as uuidv4 } from 'uuid';
import type { Player } from '../player/Player';
import { BotPlayer } from './BotPlayer';

// Bot creation utilities
const BOT_COLORS = {
  aggressive: '#666666', // Medium gray
  defensive: '#666666', // Medium gray
  patrol: '#666666', // Medium gray
};

const BOT_NAMES = {
  aggressive: 'Aggressive',
  defensive: 'Defensive',
  patrol: 'Patrol',
};

export class BotFactory {
  public createBots(count: number): Map<string, Player> {
    const bots = new Map<string, Player>();
    const botTypes: Array<'aggressive' | 'defensive' | 'patrol'> = [
      'aggressive',
      'defensive',
      'patrol',
    ];

    const positions = this.getBotStartingPositions(count);

    for (let i = 0; i < count; i++) {
      const botType = botTypes[i % botTypes.length];
      const position = positions[i];

      const bot = this.createBotPlayer(botType, position);
      bots.set(bot.id, bot);
    }

    return bots;
  }

  private createBotPlayer(
    botType: 'aggressive' | 'defensive' | 'patrol',
    position?: { x: number; y: number }
  ): Player {
    const id = uuidv4();
    const name = `${BOT_NAMES[botType]} Bot`;
    const botPlayer = new BotPlayer({ id, name, botType });

    // Set bot-specific properties
    botPlayer.color = BOT_COLORS[botType];

    if (position) {
      botPlayer.ship.position = position;
    }

    // Configure bot ship properties
    botPlayer.ship.shotCooldown = this.getBotShotCooldown(botType);
    botPlayer.ship.lastPosition = { ...botPlayer.ship.position };

    return botPlayer;
  }

  private getBotShotCooldown(botType: string): number {
    switch (botType) {
      case 'aggressive':
        return 300 + Math.random() * 700; // 0.3-1.0 seconds
      case 'defensive':
        return 500 + Math.random() * 1000; // 0.5-1.5 seconds
      case 'patrol':
        return 400 + Math.random() * 800; // 0.4-1.2 seconds
      default:
        return 500;
    }
  }

  private getBotStartingPositions(count: number): Array<{ x: number; y: number }> {
    const margin = 150;
    const positions = [
      { x: -margin, y: -margin }, // Top-left
      { x: margin, y: -margin }, // Top-right
      { x: margin, y: margin }, // Bottom-right
      { x: -margin, y: margin }, // Bottom-left
      { x: margin, y: 0 }, // Right of world center
      { x: -margin, y: 0 }, // Left of world center
      { x: 0, y: margin }, // Below world center
      { x: 0, y: -margin }, // Above world center
    ];

    return Array.from({ length: count }, (_, i) => positions[i % positions.length]);
  }
}
