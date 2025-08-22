import { FPS, SHIP_HEALTH_REGEN_DELAY, SHIP_HEALTH_REGEN_RATE } from '../../constants';
import { Vector } from '../../physics/Vector.ts';

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

export function isDebugMode(): boolean {
  return import.meta.env?.DEV === true || import.meta.env?.MODE === 'development';
}

export function calculateThrusterPosition(
  shipPosition: Vector,
  shipAngle: number,
  shipRadius: number
): Vector {
  const thrusterOffset = Vector.fromAngle(shipAngle).multiply(-shipRadius);
  return shipPosition.add(thrusterOffset);
}

export function calculateLaserStartPosition(
  shipPosition: Vector,
  shipAngle: number,
  shipRadius: number
): Vector {
  const noseOffset = Vector.fromAngle(shipAngle).multiply((4 / 3) * shipRadius);
  return shipPosition.add(noseOffset);
}
