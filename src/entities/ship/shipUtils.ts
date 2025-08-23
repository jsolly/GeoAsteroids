import { SHIP_HEALTH_REGEN_DELAY, SHIP_HEALTH_REGEN_RATE } from '../../constants/entities/ship';
import { FPS } from '../../constants/physics';
import { addPositions, createPositionFromAngle } from '../../utils/mathUtils';
import type { Position } from '../player/types';

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
  _maxHealth: number
): number {
  return Math.max(0, currentHealth - damage);
}

export function calculateHealthAfterHeal(
  currentHealth: number,
  healAmount: number,
  maxHealth: number
): number {
  return Math.min(currentHealth + healAmount, maxHealth);
}

export function calculateHealthRegenPerFrame(): number {
  return SHIP_HEALTH_REGEN_RATE / FPS;
}

export function calculateHealthRegenDelayFrames(): number {
  return Math.ceil(SHIP_HEALTH_REGEN_DELAY * FPS);
}

export function shouldStartHealthRegeneration(
  lastDamageTime: number,
  currentHealth: number,
  maxHealth: number
): boolean {
  return lastDamageTime <= 0 && currentHealth < maxHealth;
}

export function calculateLaserStartPosition(
  shipPosition: Position,
  shipAngle: number,
  shipRadius: number
): Position {
  const noseOffset = createPositionFromAngle(shipAngle, (4 / 3) * shipRadius);
  return addPositions(shipPosition, noseOffset);
}
