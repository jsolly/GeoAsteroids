import { DAMAGE } from '../../constants';
import { type Combatant, isBot, isLocal, isRemote } from '../../entities/player/playerKinds';
import { pointsForRoidSize } from '../../entities/roid/roidScore';

export function laserHitDamageMessage(
  target: Combatant,
  attackerId: string,
  damage: number = DAMAGE.LASER_HIT
): Record<string, unknown> | null {
  if (isBot(target)) {
    return {
      type: 'botDamage',
      data: { botId: target.id, attackerId, damage },
    };
  }
  if (isRemote(target) || isLocal(target)) {
    return {
      type: 'laserDamage',
      data: { targetPlayerId: target.id, attackerId, damage },
    };
  }
  return null;
}

export function asteroidCollisionDamageMessage(
  target: Combatant,
  localPlayerId: string | null,
  damage: number = DAMAGE.ASTEROID_COLLISION
): Record<string, unknown> | null {
  if (isLocal(target)) {
    if (!localPlayerId) {
      return null;
    }
    return {
      type: 'collisionDamage',
      data: {
        targetPlayerId: localPlayerId,
        attackerId: 'asteroid',
        damage,
      },
    };
  }
  if (isBot(target)) {
    return {
      type: 'botDamage',
      data: {
        botId: target.id,
        attackerId: 'asteroid',
        damage,
      },
    };
  }
  return null;
}

export function asteroidCollisionScorerId(
  target: Combatant,
  localPlayerId: string | null
): string | null {
  if (isLocal(target)) {
    return localPlayerId || null;
  }
  if (isBot(target)) {
    return target.id;
  }
  return null;
}

export function asteroidDestroyedMessage(
  asteroidId: string,
  playerId: string,
  radius: number,
  cause: 'laser' | 'collision' = 'laser',
  laserPosition?: { x: number; y: number }
): Record<string, unknown> {
  return {
    type: 'asteroidDestroyed',
    data: {
      asteroidId,
      playerId,
      points: pointsForRoidSize(radius),
      cause,
      ...(laserPosition ? { laserPosition: { x: laserPosition.x, y: laserPosition.y } } : {}),
    },
  };
}
