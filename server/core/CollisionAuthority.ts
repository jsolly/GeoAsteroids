import type { AsteroidData } from '../../shared-types';
import {
  SHIP_COLLISION_RADIUS,
  findShipAsteroidOverlaps,
  findShipShipPairs,
  isCombatantImmune,
  shipShipPairKey,
  shouldApplyShipShipTick,
  type CombatCircle,
} from '../../shared/combat';
import type { GameEntity } from './EntityManager';

export function toCombatCircle(entity: GameEntity): CombatCircle {
  return {
    id: entity.id,
    position: entity.position,
    radius: SHIP_COLLISION_RADIUS,
    immune: isCombatantImmune(entity),
  };
}

export function asteroidCollisionRadius(asteroid: AsteroidData): number {
  return asteroid.size;
}

export class CollisionAuthority {
  private shipShipLastTick = new Map<string, number>();

  public reset(): void {
    this.shipShipLastTick.clear();
  }

  public collectShipAsteroidHits(
    entities: GameEntity[],
    asteroids: AsteroidData[]
  ): Array<{ shipId: string; asteroidId: string }> {
    return findShipAsteroidOverlaps(
      entities.map(toCombatCircle),
      asteroids.map((asteroid) => ({
        id: asteroid.id,
        position: asteroid.position,
        radius: asteroidCollisionRadius(asteroid),
      }))
    );
  }

  public collectShipShipTicks(
    entities: GameEntity[],
    now: number
  ): Array<{ a: string; b: string }> {
    const pairs = findShipShipPairs(entities.map(toCombatCircle));
    const due: Array<{ a: string; b: string }> = [];
    for (const pair of pairs) {
      const key = shipShipPairKey(pair.a, pair.b);
      if (shouldApplyShipShipTick(this.shipShipLastTick.get(key), now)) {
        this.shipShipLastTick.set(key, now);
        due.push(pair);
      }
    }
    return due;
  }
}
