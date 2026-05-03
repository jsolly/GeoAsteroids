import { v4 as uuidv4 } from 'uuid';
import type { Position } from '../../../shared-types';
import { CANVAS, DEBUG } from '../../constants';
import { MockPlayerInput } from '../../input/MockPlayerInput';
import {
  getRandomPositionNearBoundary,
  getRandomPositionNearPoint,
  getRandomPositionWithinBoundary,
} from '../../utils/positionUtils';
import { Player } from './Player';

export interface PlayerCreationParams {
  id?: string;
  name: string;
  type: 'local' | 'remote' | 'bot';
  position?: Position;
  color?: string;
  shotCooldown?: number;
}

export class PlayerFactory {
  public createPlayer(params: PlayerCreationParams): Player {
    const id = params.id || uuidv4();

    // Determine position based on debug flags if none provided
    // Priority: PLACE_PLAYERS_NEAR_BOUNDARY > PLACE_PLAYERS_NEAR_CENTER > default
    let position: Position;
    if (params.position) {
      position = params.position;
    } else if (DEBUG.PLACE_PLAYERS_NEAR_BOUNDARY) {
      // Place near boundary when debug flag is enabled
      position = getRandomPositionNearBoundary();
    } else if (DEBUG.PLACE_PLAYERS_NEAR_CENTER) {
      // Place near center when debug flag is enabled
      const centerPosition = { x: CANVAS.DEFAULT_CENTER_X, y: CANVAS.DEFAULT_CENTER_Y };
      position = getRandomPositionNearPoint(centerPosition, 150); // Within 150 pixels of center
    } else {
      // Default behavior: random position within boundary
      position = getRandomPositionWithinBoundary();
    }

    const player = new Player({
      id,
      name: params.name,
      type: params.type,
      input: new MockPlayerInput(),
    });

    // Set position
    player.ship.position = position;

    // Apply type-specific customizations
    if (params.color) {
      player.color = params.color;
      player.ship.color = params.color;
    }

    if (params.shotCooldown !== undefined) {
      player.ship.shotCooldown = params.shotCooldown;
    }

    // Bot-specific customizations
    if (params.type === 'bot') {
      if (!params.color) {
        player.color = '#888888'; // Default bot color
        player.ship.color = player.color;
      }
      if (params.shotCooldown === undefined) {
        player.ship.shotCooldown = 500 + Math.random() * 500; // 0.5-1.0 seconds
      }
    }

    return player;
  }

  public createLocalPlayer(name: string, position?: Position): Player {
    return this.createPlayer({
      name,
      type: 'local',
      position,
    });
  }

  public createRemotePlayer(id: string, name: string, position: Position): Player {
    return this.createPlayer({
      id,
      name,
      type: 'remote',
      position,
    });
  }

  public createBotPlayer(name: string, position?: Position): Player {
    return this.createPlayer({
      name,
      type: 'bot',
      position,
    });
  }
}

export const playerFactory = new PlayerFactory();
