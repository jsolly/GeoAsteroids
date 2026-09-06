import type { AsteroidData, Position, ServerEntityData, ServerGameState, Velocity } from '../../shared-types';
import { DEBUG, SHIP } from '../../src/constants';

/** Playfield radius used for bot spawn and respawn placement. */
export const ARENA_RADIUS = 3100;

/** Client must echo a transform this close before the respawn anchor is released. */
export const RESPAWN_ANCHOR_ACK_DISTANCE = 100;

export const LIFECYCLE = {
  explodeFrames: SHIP.EXPLODE_DURATION_FRAMES,
  respawnFrames: SHIP.RESPAWN_DELAY_FRAMES,
  spawnProtectionFrames: SHIP.INVINCIBILITY_DURATION_FRAMES,
  arenaRadius: ARENA_RADIUS,
  respawnRadiusRatio: 0.8,
} as const;

export const COMBAT_REWARDS = {
  playerKill: 200,
  botKill: 50,
} as const;

/** Fields the explosion → respawn → spawn-protection machine reads. */
export interface LifecycleStatus {
  type: 'human' | 'bot';
  exploding: boolean;
  health: number;
  lives: number;
  respawnTimer?: number;
  spawnProtectionTimer?: number;
  respawnAnchor?: Position;
}

export function isExploding(entity: Pick<LifecycleStatus, 'exploding'>): boolean {
  return entity.exploding;
}

export function isOutOfHealth(entity: Pick<LifecycleStatus, 'health'>): boolean {
  return entity.health <= 0;
}

export function isRespawning(entity: Pick<LifecycleStatus, 'respawnTimer'>): boolean {
  return entity.respawnTimer !== undefined;
}

/** Dead, exploding, or waiting to respawn — client movement must not apply. */
export function isUnavailableForClientMovement(entity: LifecycleStatus): boolean {
  return isExploding(entity) || isRespawning(entity) || isOutOfHealth(entity);
}

export function hasActiveSpawnProtection(
  entity: Pick<LifecycleStatus, 'type' | 'spawnProtectionTimer'>
): boolean {
  if (entity.spawnProtectionTimer === undefined || entity.spawnProtectionTimer <= 0) {
    return false;
  }
  if (entity.type === 'bot') {
    return DEBUG.BOT_PLAYER.SPAWN_PROTECTION;
  }
  return true;
}

/** Hits ignored for exploding, dead, respawning, or shielded ships. */
export function isCombatInvulnerable(entity: LifecycleStatus): boolean {
  return (
    isExploding(entity) ||
    isOutOfHealth(entity) ||
    isRespawning(entity) ||
    hasActiveSpawnProtection(entity)
  );
}

/** True when a client update is still the death pose, not the new spawn. */
export function isStaleDeathPose(
  anchor: Position | undefined,
  position: Position | undefined
): boolean {
  if (!anchor || !position) {
    return false;
  }
  return Math.hypot(position.x - anchor.x, position.y - anchor.y) > RESPAWN_ANCHOR_ACK_DISTANCE;
}

export function shouldAcceptClientMovement(
  entity: LifecycleStatus,
  incomingPosition: Position | undefined
): boolean {
  if (isUnavailableForClientMovement(entity)) {
    return false;
  }
  return !isStaleDeathPose(entity.respawnAnchor, incomingPosition);
}

export function snapshotVec(vector: Position | Velocity): Position {
  return { x: vector.x, y: vector.y };
}

export function snapshotEntity(entity: ServerEntityData): ServerEntityData {
  return {
    id: entity.id,
    name: entity.name,
    type: entity.type,
    position: snapshotVec(entity.position),
    velocity: snapshotVec(entity.velocity),
    angle: entity.angle,
    exploding: entity.exploding,
    thrusting: entity.thrusting,
    color: entity.color,
    lives: entity.lives,
    score: entity.score,
    health: entity.health,
    maxHealth: entity.maxHealth,
    respawnTimer: entity.respawnTimer,
    spawnProtectionTimer: entity.spawnProtectionTimer,
  };
}

export function snapshotAsteroid(asteroid: AsteroidData): AsteroidData {
  return {
    ...asteroid,
    position: snapshotVec(asteroid.position),
    velocity: snapshotVec(asteroid.velocity),
    offsets: asteroid.offsets.slice(),
  };
}

export function snapshotGameState(state: ServerGameState): ServerGameState {
  return {
    entities: state.entities.map(snapshotEntity),
    asteroids: state.asteroids.map(snapshotAsteroid),
    gameTime: state.gameTime,
    isPaused: state.isPaused,
  };
}
