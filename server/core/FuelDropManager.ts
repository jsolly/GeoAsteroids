import type { AsteroidData, FuelDropData } from '../../shared-types';
import { createFuelDropData, shouldReleaseFuel } from '../../shared/fuel';

export class FuelDropManager {
  private drops = new Map<string, FuelDropData>();
  private nextId = 0;

  public spawnFromAsteroid(asteroid: AsteroidData): FuelDropData | undefined {
    if (!shouldReleaseFuel(asteroid.size)) {
      return undefined;
    }

    const drop = createFuelDropData(`server-fuel-${this.nextId++}`, asteroid.position);
    this.drops.set(drop.id, drop);
    return drop;
  }

  public addDrop(drop: FuelDropData): void {
    this.drops.set(drop.id, drop);
  }

  public removeDrop(dropId: string): FuelDropData | undefined {
    const drop = this.drops.get(dropId);
    if (drop) {
      this.drops.delete(dropId);
    }
    return drop;
  }

  public getDrop(dropId: string): FuelDropData | undefined {
    return this.drops.get(dropId);
  }

  public getAllDrops(): FuelDropData[] {
    return Array.from(this.drops.values());
  }

  public getDropCount(): number {
    return this.drops.size;
  }

  public clearDrops(): void {
    this.drops.clear();
    this.nextId = 0;
  }
}
