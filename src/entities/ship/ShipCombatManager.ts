import { playSound, Sound } from '../../audio/Sound';
import { SHIP_MAX_LASERS } from '../../constants';
import { EMP_PULSE_DURATION, FPS } from '../../constants/game';
import type { Laser } from '../laser/Laser';
import { createLaser } from '../laser/laserUtils';
import type { Ship } from './Ship';
import {
  calculateHealthAfterDamage,
  calculateHealthAfterHeal,
  calculateHealthRegenDelayFrames,
  calculateHealthRegenPerFrame,
  canTakeCollisionDamage as canTakeCollisionDamageUtil,
  shouldStartHealthRegeneration,
} from './shipUtils';

export interface ShipCombatState {
  lasers: Laser[];
  canShoot: boolean;
  lastShotTime: number;
  shotCooldown: number;
  health: number;
  maxHealth: number;
  lastDamageTime: number;
  healthRegenTimer: number;
  lastCollisionTime: number;
  empPulseActive: boolean;
  empPulseTime: number;
}

// Module-level sound instance
const fxExplode = new Sound('sounds/explode.m4a', 5);

/**
 * Check if the ship can shoot again
 */
export function canShootAgain(state: ShipCombatState, maxLasers: number): boolean {
  if (state.canShoot && state.lasers.length < maxLasers) {
    return true;
  }
  state.canShoot = false;
  return false;
}

/**
 * Create and add a laser to the ship's arsenal
 */
export function shoot(ship: Ship, state: ShipCombatState): void {
  if (canShootAgain(state, SHIP_MAX_LASERS)) {
    const laser = createLaser(ship);
    state.lasers.push(laser);
    laser.playLaserSound();
    state.lastShotTime = Date.now();
  }
}

/**
 * Update laser states and remove expired ones
 */
export function updateLasers(state: ShipCombatState): void {
  for (let i = state.lasers.length - 1; i >= 0; i--) {
    const laser = state.lasers[i];
    laser.move();

    // Remove lasers that have traveled their maximum distance OR finished exploding
    if (laser.shouldBeRemoved()) {
      state.lasers.splice(i, 1);
    }
  }
}

/**
 * Apply damage to the ship
 */
export function takeDamage(state: ShipCombatState, amount: number): boolean {
  state.health = calculateHealthAfterDamage(state.health, amount, state.maxHealth);
  state.lastDamageTime = FPS;
  state.healthRegenTimer = calculateHealthRegenDelayFrames();

  if (state.health <= 0) {
    state.health = 0;
    return true; // Ship should explode
  }

  return false; // Ship survived
}

/**
 * Heal the ship
 */
export function heal(state: ShipCombatState, amount: number): void {
  state.health = calculateHealthAfterHeal(state.health, amount, state.maxHealth);
}

/**
 * Update health regeneration
 */
export function updateHealth(state: ShipCombatState): void {
  if (state.lastDamageTime > 0) {
    state.lastDamageTime--;
  }

  if (shouldStartHealthRegeneration(state.lastDamageTime, state.health, state.maxHealth)) {
    if (state.healthRegenTimer <= 0) {
      const healthBefore = state.health;
      heal(state, calculateHealthRegenPerFrame());
      const healthAfter = state.health;

      if (healthBefore !== healthAfter) {
        // Health regenerated - could emit event here
      }
    } else {
      state.healthRegenTimer--;
    }
  }
}

/**
 * Check if ship can take collision damage
 */
export function canTakeCollisionDamage(state: ShipCombatState, cooldownMs: number = 500): boolean {
  return canTakeCollisionDamageUtil(state.lastCollisionTime, cooldownMs);
}

/**
 * Activate EMP pulse
 */
export function activateEmpPulse(ship: Ship, state: ShipCombatState): void {
  if (state.empPulseActive) {
    return;
  }

  state.empPulseActive = true;
  state.empPulseTime = Math.ceil(EMP_PULSE_DURATION * FPS);
  playSound(fxExplode);

  // Dispatch EMP pulse event with actual ship position and radius
  const empEvent = new CustomEvent('empPulse', {
    detail: {
      shipPosition: ship.position,
      shipRadius: ship.r,
    },
  });

  window.dispatchEvent(empEvent);
}

/**
 * Update EMP pulse state
 */
export function updateEmpPulse(state: ShipCombatState): void {
  if (state.empPulseActive) {
    state.empPulseTime--;
    if (state.empPulseTime <= 0) {
      state.empPulseActive = false;
      state.empPulseTime = 0;
    }
  }
}

/**
 * Get combat data for network synchronization
 */
export function getCombatData(state: ShipCombatState): {
  health: number;
  empPulseActive: boolean;
} {
  return {
    health: state.health,
    empPulseActive: state.empPulseActive,
  };
}
