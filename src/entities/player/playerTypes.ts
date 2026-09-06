import type { Position } from '../../../shared-types';
import type { Ship } from '../ship/Ship';

export type PlayerType = 'local' | 'remote' | 'bot';

/** Minimal actor shape shared by the game loop and collision manager. */
export interface CollisionActor {
  id: string;
  type: PlayerType;
  ship: Ship;
}

/** Fields the client applies from a server entity snapshot. */
export interface ServerPlayerSnapshot {
  position?: Position;
  velocity?: Position;
  angle?: number;
  lives?: number;
  score?: number;
  exploding?: boolean;
  thrusting?: boolean;
  color?: string;
  deathCause?: string;
  health?: number;
  maxHealth?: number;
  respawnTimer?: number;
  spawnProtectionTimer?: number;
}
