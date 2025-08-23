import { v4 as uuidv4 } from 'uuid';
import { getRandomPositionWithinBoundary } from '../../utils/positionUtils';
import { Player } from '../player/Player';

export class BotFactory {
  public createBots(count: number): Map<string, Player> {
    const bots = new Map<string, Player>();
    const positions = this.getBotStartingPositions(count);

    for (let i = 0; i < count; i++) {
      const position = positions[i];
      const bot = this.createBotPlayer(position);
      bots.set(bot.id, bot);
    }

    return bots;
  }

  private createBotPlayer(position?: { x: number; y: number }): Player {
    const id = uuidv4();
    const name = 'Bot';
    const botPlayer = new Player({ id, name, type: 'bot' });

    // Set bot color to space gray
    botPlayer.color = '#888888';
    botPlayer.ship.color = botPlayer.color;

    if (position) {
      botPlayer.ship.position = position;
    }

    // Configure bot ship properties
    botPlayer.ship.shotCooldown = 500 + Math.random() * 500; // 0.5-1.0 seconds
    botPlayer.ship.lastPosition = { ...botPlayer.ship.position };

    return botPlayer;
  }

  private getBotStartingPositions(count: number): Array<{ x: number; y: number }> {
    const positions: Array<{ x: number; y: number }> = [];

    // Generate random positions within the boundary for each bot
    for (let i = 0; i < count; i++) {
      positions.push(getRandomPositionWithinBoundary());
    }

    return positions;
  }
}
