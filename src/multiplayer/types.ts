import type {
  GameState,
  PlayerJoin,
  PlayerLeave,
  PlayerShoot,
  PlayerUpdate,
} from '../../shared-types';
import type { BotShoot } from '../entities/bot/types';

// Re-export GameState for convenience
export type { GameState };

export interface ServerMessage {
  type:
    | 'playerJoined'
    | 'playerLeft'
    | 'playerUpdate'
    | 'playerShoot'
    | 'playerDamaged'
    | 'playerKilled'
    | 'scoreUpdate'
    | 'gameState'
    | 'botShoot'
    | 'error'
    | 'botUpdate'
    | 'botCreate'
    | 'botRemove'
    | 'botDestroyed'
    | 'botDamaged'
    | 'botInitialized'
    | 'joined'
    | 'asteroidCreate'
    | 'asteroidUpdate'
    | 'asteroidDestroy';
  payload:
    | PlayerJoin
    | PlayerLeave
    | PlayerUpdate
    | PlayerShoot
    | GameState
    | BotShoot
    | string
    | unknown; // Flexible payload for custom messages
  timestamp: number;
}

export interface ClientMessage {
  type:
    | 'join'
    | 'leave'
    | 'update'
    | 'shoot'
    | 'botShoot'
    | 'initBots'
    | 'botDestroyed'
    | 'botUpdate'
    | 'botDamage'
    | 'empDestroy'
    | 'laserDamage'
    | 'playerKilled'
    | 'initAsteroids'
    | 'asteroidDestroyed'
    | 'asteroidCreate'
    | 'asteroidUpdate'
    | 'asteroidDestroy'
    | 'clientLog';
  id?: string; // Optional ID field for messages that need it
  data: PlayerJoin | PlayerLeave | PlayerUpdate | PlayerShoot | BotShoot | unknown; // Flexible payload for custom messages
  timestamp: number;
}
