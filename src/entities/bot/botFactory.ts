import { v4 as uuidv4 } from 'uuid';
import type { Position } from '../player/types';
import { BotPlayer } from './BotPlayer';

export class BotFactory {
  public createBots(count: number): Map<string, BotPlayer> {
    const bots = new Map<string, BotPlayer>();
    const botTypes: Array<'aggressive' | 'defensive' | 'patrol'> = [
      'aggressive',
      'defensive',
      'patrol',
    ];

    for (let i = 0; i < count; i++) {
      const botId = `bot-${uuidv4()}`;
      const botType = botTypes[i % botTypes.length];

      // Position bots around the edges of the screen
      const position = this.getBotStartingPosition(i);

      const bot = new BotPlayer(botId, `Bot_${botType.charAt(0).toUpperCase()}_${i + 1}`, botType);

      // Configure the bot's ship after creation
      bot.ship.position = position; // Override default (0,0) - bots spawn at specific world positions
      bot.ship.shotCooldown = this.getBotShotCooldown(botType);
      bot.ship.lastPosition = { x: position.x, y: position.y }; // Clone to avoid aliasing
      bots.set(botId, bot);
    }

    return bots;
  }

  private getBotStartingPosition(index: number): Position {
    // Use world coordinates instead of canvas coordinates
    // Position bots at a moderate distance from the world origin (0, 0) where the ship starts
    const margin = 150; // Moderate distance for dramatic entrance

    // Mix of positions around the center for dramatic hunting
    const positions: Position[] = [
      { x: -margin, y: -margin }, // Top-left
      { x: margin, y: -margin }, // Top-right
      { x: margin, y: margin }, // Bottom-right
      { x: -margin, y: margin }, // Bottom-left
      { x: margin, y: 0 }, // Right of world center
      { x: -margin, y: 0 }, // Left of world center
      { x: 0, y: margin }, // Below world center
      { x: 0, y: -margin }, // Above world center
    ];

    return positions[index % positions.length];
  }

  private getBotShotCooldown(botType: string): number {
    switch (botType) {
      case 'aggressive':
        return 300 + Math.random() * 700; // 0.3-1.0 seconds (much more aggressive)
      case 'defensive':
        return 500 + Math.random() * 1000; // 0.5-1.5 seconds (more aggressive)
      case 'patrol':
        return 400 + Math.random() * 800; // 0.4-1.2 seconds (more aggressive)
      default:
        return 500;
    }
  }
}
