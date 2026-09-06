import type { Position } from '../../../shared-types';
import { GAME, SHIP } from '../../constants';
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
