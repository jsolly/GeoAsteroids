import type { BotPlayerInterface, BotShoot } from '../entities/bot/index.ts';
import type {
  PlayerInterface as Player,
  PlayerJoin,
  PlayerLeave,
  PlayerShoot,
  PlayerUpdate,
} from '../entities/player/index.ts';
import type { Vector } from '../physics/Vector.ts';

export interface GameState {
  players: Array<{
    id: string;
    name: string;
    position: Vector;
    velocity: Vector;
    r: number;
    a: number;
    lives: number;
    score: number;
    exploding: boolean;
  }>;
  asteroids: Array<{
    position: Vector;
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

// Re-export player and bot types for convenience
export type { Player, PlayerUpdate, PlayerJoin, PlayerLeave, PlayerShoot };
export type { BotPlayerInterface as BotPlayer, BotShoot };
