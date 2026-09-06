import type { Position } from '../../../shared-types';
import { DAMAGE, GAME, SHIP } from '../../constants';
import { checkBoundaryCollision } from '../../physics/collision/collisionDetection';
import { addPositions, createPositionFromAngle } from '../../utils/mathUtils';

/** Minimal ship shape shared by local players, remotes, and bots. */
export interface ShipCollisionState {
  exploding: boolean;
  health: number;
  blinkCount: number;
}

export interface ShipSpawnProtectionState {
  blinkCount: number;
  spawnProtectionTimer: number;
  setBlinkOn(): void;
}

export interface SharedShipCombatVisuals extends ShipSpawnProtectionState {
  exploding: boolean;
  explodeTime: number;
  health: number;
  explode(cause?: string, killerName?: string): void;
}

export interface ShipImpactFlashState {
  impactFlashFrames: number;
}

export interface ShipLethalHitState extends ShipImpactFlashState {
  health: number;
  exploding: boolean;
  takeDamage(amount: number, cause?: string, killerName?: string): void;
}

/** Only a positive timer is an active respawn countdown. Omitted or 0 is not dead. */
export function isServerRespawnActive(respawnTimer?: number): boolean {
  return respawnTimer !== undefined && respawnTimer > 0;
}

/**
 * Established session progress must not snap back to a fresh 3-life / 0-score
 * spawn unless this really is a new local player object.
 */
export function isSilentHudReset(
  currentLives: number,
  currentScore: number,
  incomingLives?: number,
  incomingScore?: number
): boolean {
  if (incomingLives === undefined && incomingScore === undefined) {
    return false;
  }
  const nextLives = incomingLives ?? currentLives;
  const nextScore = incomingScore ?? currentScore;
  // Game-over (0 lives) may start a new ship at 3/0; mid-run progress must not.
  const established = currentLives > 0 && (currentScore > 0 || currentLives < GAME.START_LIVES);
  return established && nextLives === GAME.START_LIVES && nextScore === GAME.STARTING_SCORE;
}

/** Explode / clear the exploding flag. Shared by local, remote, and bot ships. */
export function applySharedShipExplodingFlag(
  ship: Pick<SharedShipCombatVisuals, 'exploding' | 'health' | 'explode'>,
  exploding: boolean | undefined,
  cause = 'server-damage'
): void {
  if (exploding === true) {
    // Hitch catch-up can finish the local FX while the server is still
    // exploding. Do not rewind explodeTime — that restacked the death window.
    if (!ship.exploding && ship.health > 0) {
      ship.explode(cause);
    }
    return;
  }
  if (exploding === false) {
    ship.exploding = false;
  }
}

/** Arm blink after death→alive or when the server still has spawn protection. */
export function applySharedShipRespawnCue(
  ship: SharedShipCombatVisuals,
  wasDeadOrExploding: boolean,
  spawnProtectionTimer?: number
): void {
  if (wasDeadOrExploding && ship.health > 0) {
    if (ship.exploding) {
      ship.exploding = false;
      ship.explodeTime = 0;
    }
    applyShipSpawnProtection(ship);
    return;
  }
  if (
    ship.health > 0 &&
    ship.blinkCount <= 0 &&
    spawnProtectionTimer !== undefined &&
    spawnProtectionTimer > 0
  ) {
    applyShipSpawnProtection(ship);
  }
}

/** Prefer a known cause; a hull past the arena edge is a wall death. */
export function resolveCombatDeathCause(
  known: string | undefined,
  ship?: { position: Position; r: number }
): string {
  if (known && known !== 'unknown') {
    return known;
  }
  if (ship && checkBoundaryCollision(ship.position, ship.r)) {
    return 'boundary';
  }
  return known ?? 'unknown';
}

/** Overlay copy. Never print "unknown". */
export function formatDeathCauseForOverlay(cause?: string): string | undefined {
  if (!cause || cause === 'unknown' || cause === 'server-damage') {
    return undefined;
  }
  if (cause === 'boundary') {
    return 'the arena wall';
  }
  if (cause === 'asteroid') {
    return 'an asteroid';
  }
  return cause;
}

/**
 * Instant-kill environment hit (wall or roid): flash + shared explode path.
 * Player and bot ships both use this — one DRY ship type.
 */
export function applyShipLethalCollision(
  ship: ShipLethalHitState,
  cause: 'boundary' | 'asteroid'
): void {
  applyShipImpactFlash(ship);
  if (!ship.exploding) {
    const damage = cause === 'asteroid' ? DAMAGE.ASTEROID_COLLISION : DAMAGE.BOUNDARY_COLLISION;
    ship.takeDamage(damage, cause);
  }
}

/** Instant-kill wall contact: flash + shared takeDamage/explode path. */
export function applyShipBoundaryDeath(ship: ShipLethalHitState, cause = 'boundary'): void {
  applyShipLethalCollision(ship, cause === 'asteroid' ? 'asteroid' : 'boundary');
}

/** True when a ship must not report or receive collision damage. */
export function isShipCollisionImmune(ship: ShipCollisionState): boolean {
  return ship.exploding || ship.health <= 0 || ship.blinkCount > 0;
}

/** Arm the client blink window used by players and bots. */
export function applyShipSpawnProtection(ship: ShipSpawnProtectionState): void {
  ship.blinkCount = Math.ceil(
    SHIP.INVINCIBILITY_DURATION_FRAMES / SHIP.INVINCIBILITY_BLINK_DURATION_FRAMES
  );
  ship.spawnProtectionTimer = SHIP.INVINCIBILITY_BLINK_DURATION_FRAMES;
  ship.setBlinkOn();
}

/**
 * playerDamaged must never raise health. Ignored hits (spawn protection)
 * still arrive with remainingHealth=100 and would "heal" a dead ship at
 * the death pose, skipping the blink arm in updateFromServer.
 */
export function shouldApplyDamagedHealth(
  currentHealth: number,
  remainingHealth: number,
  isDestroyed: boolean
): boolean {
  return isDestroyed || remainingHealth < currentHealth;
}

export function canTakeCollisionDamage(
  lastCollisionTime: number,
  cooldownMs: number = 500
): boolean {
  const now = Date.now();
  if (now - lastCollisionTime < cooldownMs) {
    return false;
  }
  return true;
}

/** Short phosphor ring so a roid graze is visible before the server health packet. */
export function applyShipImpactFlash(ship: ShipImpactFlashState): void {
  ship.impactFlashFrames = SHIP.IMPACT_FLASH_FRAMES;
}

export function tickShipImpactFlash(ship: ShipImpactFlashState): void {
  if (ship.impactFlashFrames > 0) {
    ship.impactFlashFrames -= 1;
  }
}

export function calculateHealthAfterDamage(
  currentHealth: number,
  damage: number,
  maxHealth: number
): number {
  const afterDamage = currentHealth - damage;
  // Clamp between 0 and maxHealth
  return Math.min(maxHealth, Math.max(0, afterDamage));
}

export function calculateHealthAfterHeal(
  currentHealth: number,
  healAmount: number,
  maxHealth: number
): number {
  return Math.min(currentHealth + healAmount, maxHealth);
}

export function calculateHealthRegenPerFrame(): number {
  return SHIP.HEALTH_REGEN_RATE / GAME.FPS;
}

export function calculateHealthRegenDelayFrames(): number {
  return Math.ceil(SHIP.HEALTH_REGEN_DELAY * GAME.FPS);
}

export function shouldStartHealthRegeneration(
  lastDamageTime: number,
  currentHealth: number,
  maxHealth: number
): boolean {
  // Dead ships (health 0) await server respawn — never regen locally from zero.
  return lastDamageTime <= 0 && currentHealth > 0 && currentHealth < maxHealth;
}

export function calculateLaserStartPosition(
  shipPosition: Position,
  shipAngle: number,
  shipRadius: number
): Position {
  const noseOffset = createPositionFromAngle(shipAngle, (4 / 3) * shipRadius);
  return addPositions(shipPosition, noseOffset);
}
