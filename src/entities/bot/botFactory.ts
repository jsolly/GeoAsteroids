import type { Position } from '../../../shared-types';
import { DEBUG } from '../../constants';
import { getGameBoundary } from '../../physics/boundary';
import {
  getRandomPositionNearPoint,
  getRandomPositionWithinBoundary,
} from '../../utils/positionUtils';
import type { Player } from '../player/Player';
import { playerFactory } from '../player/PlayerFactory';

export class BotFactory {
  public createBots(count: number, localPlayerPosition?: Position): Map<string, Player> {
    const bots = new Map<string, Player>();
    const positions = this.getBotStartingPositions(count, localPlayerPosition);

    for (let i = 0; i < count; i++) {
      const position = positions[i];
      const bot = this.createBotPlayer(position);
      bots.set(bot.id, bot);
    }

    return bots;
  }

  private createBotPlayer(position?: { x: number; y: number }): Player {
    const name = this.generateBotName();
    const botPlayer = playerFactory.createBotPlayer(name, position);

    // Set last position for movement tracking
    botPlayer.ship.lastPosition = { ...botPlayer.ship.position };

    return botPlayer;
  }

  private generateBotName(): string {
    const adjectives = [
      'Crimson',
      'Nebula',
      'Quantum',
      'Cosmic',
      'Lunar',
      'Solar',
      'Galactic',
      'Star',
      'Nova',
      'Meteor',
    ];
    const nouns = [
      'Falcon',
      'Viper',
      'Ranger',
      'Specter',
      'Comet',
      'Warden',
      'Drifter',
      'Marauder',
      'Pioneer',
      'Corsair',
    ];

    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    return `${adjective} ${noun}`;
  }

  private getBotStartingPositions(
    count: number,
    _localPlayerPosition?: Position
  ): Array<{ x: number; y: number }> {
    const positions: Array<{ x: number; y: number }> = [];
    const shouldPlaceNearCenter = DEBUG.PLACE_PLAYERS_NEAR_CENTER;

    // Generate positions based on debug configuration
    for (let i = 0; i < count; i++) {
      if (shouldPlaceNearCenter) {
        // Place bots near the center when debug flag is enabled
        const boundary = getGameBoundary();
        const center = { x: boundary.cx, y: boundary.cy };
        const position = getRandomPositionNearPoint(center, 200);
        positions.push(position);
      } else {
        // Place bots randomly within the boundary (default behavior)
        positions.push(getRandomPositionWithinBoundary());
      }
    }

    return positions;
  }
}
