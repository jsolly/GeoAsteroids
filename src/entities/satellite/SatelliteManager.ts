import type { Position, SatelliteData, Velocity } from '../../../shared-types';
import { entityFactory } from '../EntityFactory';
import { Satellite } from './Satellite';

export class SatelliteManager {
  private static instance: SatelliteManager;
  private satellites = new Map<string, Satellite>();

  static getInstance(): SatelliteManager {
    if (!SatelliteManager.instance) {
      SatelliteManager.instance = new SatelliteManager();
    }
    return SatelliteManager.instance;
  }

  getAll(): Satellite[] {
    return Array.from(this.satellites.values());
  }

  get(id: string): Satellite | undefined {
    return this.satellites.get(id);
  }

  clear(): void {
    this.satellites.clear();
  }

  syncFromServer(list: SatelliteData[]): void {
    const seen = new Set(list.map((item) => item.id));
    for (const id of this.satellites.keys()) {
      if (!seen.has(id)) {
        this.satellites.delete(id);
      }
    }
    for (const data of list) {
      const existing = this.satellites.get(data.id);
      if (existing) {
        existing.updateFromServer(data);
      } else {
        this.satellites.set(data.id, new Satellite(data));
      }
    }
  }

  addLaser(satelliteId: string, position: Position, velocity: Velocity): void {
    const satellite = this.satellites.get(satelliteId);
    if (!satellite) {
      return;
    }
    satellite.lasers.push(
      entityFactory.createLaser({
        position: { ...position },
        velocity: { ...velocity },
        distTraveled: 0,
        explodeTime: 0,
        hasExploded: false,
      })
    );
  }

  update(): void {
    for (const satellite of this.satellites.values()) {
      satellite.update();
    }
  }
}
