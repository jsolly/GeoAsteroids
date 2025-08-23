// Main collisions module that orchestrates all collision detection
// This file now serves as a facade for the modular collision system

export {
  detectBoundaryCollisions,
  detectPlayerBoundaryCollisions,
} from '../../rendering/boundaryRenderer';

// Re-export utility functions and interfaces
export {
  dispatchBotDestroyedEvent,
  isPlayerInvincible,
  isShipInvincible,
  shouldApplyDamageToLocalPlayer,
  shouldSkipPlayerCollision,
} from './collisionUtils';

// Re-export all collision functions from their respective modules
export {
  detectLaserHits,
  detectLaserPlayerCollisions,
  detectPlayerLaserShipCollisions,
  isHit,
  isLaserHitBot,
} from './laserCollisions';

export {
  detectAllPlayerBotCollisions,
  detectPlayerAsteroidCollisions,
  detectRoidHits,
  detectShipToShipCollisions,
} from './shipCollisions';
