import type {
  GameState,
  PlayerJoin,
  PlayerLeave,
  PlayerShoot,
  PlayerUpdate,
} from '../../shared-types';

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
    | 'error'
    | 'joined'
    | 'asteroidCreate'
    | 'asteroidCreateBatch'
    | 'asteroidUpdate'
    | 'asteroidDestroy';
  // Prefer `data`; accept `payload` temporarily during transition
  data?: PlayerJoin | PlayerLeave | PlayerUpdate | PlayerShoot | GameState | string | unknown;
  payload?: PlayerJoin | PlayerLeave | PlayerUpdate | PlayerShoot | GameState | string | unknown;
  // Some messages historically included top-level fields (id/name/position). Keep them optional to avoid type errors during migration.
  id?: string;
  name?: string;
  position?: unknown;
  timestamp: number;
}

export interface ClientMessage {
  type:
    | 'join'
    | 'leave'
    | 'update'
    | 'shoot'
    | 'collisionDamage'
    | 'asteroidDamage'
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
  data: PlayerJoin | PlayerLeave | PlayerUpdate | PlayerShoot | unknown; // Flexible payload for custom messages
  timestamp: number;
}
