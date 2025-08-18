import type { Vector } from '../../physics/Vector.ts';
import type { Player } from '../player/types.ts';

export interface BotPlayer extends Player {
  isBot: true;
  botType: 'aggressive' | 'defensive' | 'patrol';
  behaviorState: 'patrolling' | 'hunting' | 'evading';
  lastBehaviorChange: number;
  // Note: health, maxHealth, lastDamageTime, healthRegenTimer, blinkCount, spawnProtectionTimer, blinkOn, explodeTime,
  // lastShotTime, shotCooldown, thrusterActive, lastPosition, lastRotation, respawnTimer, respawnPosition,
  // spawnProtectedUntil are now handled by the base Player and Ship classes
}

export interface BotShoot {
  botId: string;
  laserStart: Vector;
  laserDirection: Vector;
  targetPlayerId: string;
}

export interface BotBullet {
  id: string;
  botId: string;
  position: Vector;
  direction: Vector;
  speed: number;
  distanceTraveled: number;
  maxDistance: number;
  createdAt: number;
}
