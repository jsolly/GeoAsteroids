import type {
  PlayerJoin,
  PlayerLeave,
  PlayerShoot,
  PlayerUpdate,
  Position,
  Velocity,
} from '../../shared-types';
import type { BotShoot } from '../entities/bot/types';

export interface GameState {
  players: Array<{
    id: string;
    name: string;
    position: Position;
    velocity: Velocity;
    r: number;
    angle: number;
    lives: number;
    score: number;
    exploding: boolean;
  }>;
  roids: Array<{
    position: Position;
    size: number;
    jaggedness: number;
  }>;
  gameTime: number;
}

export interface ServerMessage {
  type:
    | 'playerJoin'
    | 'playerLeave'
    | 'playerUpdate'
    | 'playerShoot'
    | 'gameState'
    | 'botShoot'
    | 'error';
  data: PlayerJoin | PlayerLeave | PlayerUpdate | PlayerShoot | GameState | BotShoot | string;
  timestamp: number;
}

export interface ClientMessage {
  type: 'join' | 'leave' | 'update' | 'shoot' | 'botShoot';
  data: PlayerJoin | PlayerLeave | PlayerUpdate | PlayerShoot | BotShoot;
  timestamp: number;
}
