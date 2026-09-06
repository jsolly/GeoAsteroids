import type { Position } from '../../../shared-types';
import { entityFactory } from '../EntityFactory';
import type { Player } from './Player';

export interface PlayerCreationParams {
  id?: string;
  name: string;
  type: 'local' | 'remote' | 'bot';
  position?: Position;
  color?: string;
  shotCooldown?: number;
}

/** Facade over EntityFactory — player and bot ships share one spawn path. */
export class PlayerFactory {
  public createPlayer(params: PlayerCreationParams): Player {
    return entityFactory.createPlayer(params);
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
