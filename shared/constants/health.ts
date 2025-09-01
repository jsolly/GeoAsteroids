/* =============
Health Constants
============= */

// Game timing constants
export const GAME_FPS = 60;

// Health regeneration constants
export const HEALTH_REGEN_RATE = 1; // per second
export const HEALTH_REGEN_DELAY = 5; // seconds
export const MAX_HEALTH = 100;

// Health regeneration utility functions
export function calculateHealthRegenPerFrame(): number {
  return HEALTH_REGEN_RATE / GAME_FPS;
}

export function calculateHealthRegenDelayFrames(): number {
  return Math.ceil(HEALTH_REGEN_DELAY * GAME_FPS);
}

export function shouldStartHealthRegeneration(
  lastDamageTime: number,
  currentHealth: number,
  maxHealth: number
): boolean {
  // lastDamageTime represents frames elapsed since last damage
  // Health regeneration should start after the delay period
  return lastDamageTime >= calculateHealthRegenDelayFrames() && currentHealth < maxHealth;
}

export function calculateHealthAfterHeal(
  currentHealth: number,
  healAmount: number,
  maxHealth: number
): number {
  return Math.min(currentHealth + healAmount, maxHealth);
}
