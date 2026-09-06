import type { Position, SatelliteData, SatelliteShoot } from '../../shared-types';
import { DEBUG, SATELLITE } from '../../src/constants';
import { SAUCER_HULL_COLOR } from '../../src/entities/npc/saucerRenderHook';
import {
  aimAngleToward,
  applyAimJitter,
  clampToRadius,
  distanceTo,
  figure8Offset,
  findNearestLivingTarget,
  laserStartFromAngle,
  laserVelocityFromAngle,
  type AimTarget,
} from '../../src/entities/satellite/satelliteMath';
import { logger } from '../../setup/serverLogger';
import { RNGService } from './RNGService';

const SATELLITE_NAMES = ['Sputnik', 'Telstar', 'Voyager', 'Luna'];

export type SatelliteTarget = AimTarget;

interface SatelliteInternal extends SatelliteData {
  orbitCenter: Position;
  orbitPhase: number;
  orbitRadiusX: number;
  orbitRadiusY: number;
  shootCooldown: number;
  explodeTime: number;
  respawnTimer: number;
  driftAngle: number;
}

export class SatelliteManager {
  private satellites = new Map<string, SatelliteInternal>();
  private rng: RNGService;
  private isCreating = false;
  private nextIndex = 0;

  constructor(rngService: RNGService) {
    this.rng = rngService;
  }

  public getCount(): number {
    return this.satellites.size;
  }

  public getSatellite(id: string): SatelliteInternal | undefined {
    return this.satellites.get(id);
  }

  public getAllSatellites(): SatelliteData[] {
    return Array.from(this.satellites.values()).map((satellite) => this.toPublic(satellite));
  }

  public clearSatellites(): void {
    this.satellites.clear();
    this.nextIndex = 0;
  }

  public createSatellitesSafely(count: number, bounds = { radius: 3100 }): SatelliteData[] | null {
    if (this.isCreating) {
      return null;
    }
    this.isCreating = true;
    try {
      if (this.getCount() === 0) {
        return this.createSatellites(count, bounds);
      }
      return this.ensureAmbient(count, bounds);
    } finally {
      this.isCreating = false;
    }
  }

  public createSatellites(count: number, bounds = { radius: 3100 }): SatelliteData[] {
    this.satellites.clear();
    this.nextIndex = 0;
    const satelliteCount = Math.min(DEBUG.SATELLITE.COUNT ?? count, SATELLITE.MAX_COUNT);
    const created: SatelliteData[] = [];

    for (let i = 0; i < satelliteCount; i++) {
      const satellite = this.spawnSatellite(this.nextIndex++, bounds);
      this.satellites.set(satellite.id, satellite);
      created.push(this.toPublic(satellite));
    }

    logger.info(`🛰️ Created ${created.length} ambient hostile NPCs`);
    return created;
  }

  public ensureAmbient(
    count: number = SATELLITE.AMBIENT_COUNT,
    bounds = { radius: 3100 }
  ): SatelliteData[] {
    const target = Math.min(DEBUG.SATELLITE.COUNT ?? count, SATELLITE.MAX_COUNT);
    const created: SatelliteData[] = [];
    while (this.satellites.size < target) {
      const satellite = this.spawnSatellite(this.nextIndex++, bounds);
      this.satellites.set(satellite.id, satellite);
      created.push(this.toPublic(satellite));
    }
    return created;
  }

  public damageSatellite(satelliteId: string, damage: number): SatelliteInternal | undefined {
    const satellite = this.satellites.get(satelliteId);
    if (!satellite) {
      return undefined;
    }
    if (satellite.exploding || satellite.respawnTimer > 0 || satellite.health <= 0) {
      return undefined;
    }

    satellite.health = Math.max(0, satellite.health - damage);
    if (satellite.health <= 0) {
      satellite.exploding = true;
      satellite.explodeTime = SATELLITE.EXPLODE_DURATION_FRAMES;
    }
    return satellite;
  }

  public update(targets: SatelliteTarget[]): SatelliteShoot[] {
    const shots: SatelliteShoot[] = [];
    for (const satellite of this.satellites.values()) {
      const shot = this.updateOne(satellite, targets);
      if (shot) {
        shots.push(shot);
      }
    }
    return shots;
  }

  private updateOne(satellite: SatelliteInternal, targets: SatelliteTarget[]): SatelliteShoot | null {
    if (satellite.exploding) {
      satellite.explodeTime -= 1;
      if (satellite.explodeTime <= 0) {
        satellite.exploding = false;
        satellite.health = satellite.maxHealth;
        satellite.respawnTimer = SATELLITE.RESPAWN_FRAMES;
        this.repositionNearTargets(satellite, targets);
      }
      return null;
    }

    if (satellite.respawnTimer > 0) {
      satellite.respawnTimer -= 1;
      return null;
    }

    const living = targets.filter((target) => !target.exploding && target.health > 0);
    if (living.length > 0) {
      let nearestDist = Number.POSITIVE_INFINITY;
      for (const target of living) {
        nearestDist = Math.min(nearestDist, distanceTo(satellite.position, target.position));
      }
      if (nearestDist > SATELLITE.DESPAWN_DISTANCE) {
        this.repositionNearTargets(satellite, living);
      }
    }

    if (DEBUG.SATELLITE.MOVEMENT) {
      this.advanceOrbit(satellite);
    }

    const nearest = findNearestLivingTarget(satellite.position, targets);
    if (nearest) {
      satellite.angle = aimAngleToward(satellite.position, nearest.position);
    }

    if (!DEBUG.SATELLITE.LASERS || !nearest) {
      return null;
    }

    satellite.shootCooldown -= 1;
    if (satellite.shootCooldown > 0) {
      return null;
    }

    const aimed = applyAimJitter(satellite.angle, SATELLITE.AIM_JITTER, () => this.rng.random());
    satellite.shootCooldown = SATELLITE.SHOOT_INTERVAL_FRAMES;
    return {
      id: satellite.id,
      laserStart: laserStartFromAngle(satellite.position, aimed, satellite.radius),
      laserDirection: laserVelocityFromAngle(aimed, satellite.velocity),
    };
  }

  private advanceOrbit(satellite: SatelliteInternal): void {
    const prev = { x: satellite.position.x, y: satellite.position.y };
    satellite.orbitCenter.x += Math.cos(satellite.driftAngle) * SATELLITE.DRIFT_SPEED;
    satellite.orbitCenter.y += Math.sin(satellite.driftAngle) * SATELLITE.DRIFT_SPEED;
    satellite.orbitCenter = clampToRadius(satellite.orbitCenter, SATELLITE.BOUNDARY_RADIUS);

    const centerDist = Math.hypot(satellite.orbitCenter.x, satellite.orbitCenter.y);
    if (centerDist > SATELLITE.BOUNDARY_RADIUS - 80) {
      satellite.driftAngle = Math.atan2(-satellite.orbitCenter.y, -satellite.orbitCenter.x);
    }

    satellite.orbitPhase += SATELLITE.ORBIT_SPEED;
    const offset = figure8Offset(
      satellite.orbitPhase,
      satellite.orbitRadiusX,
      satellite.orbitRadiusY
    );
    satellite.position = clampToRadius(
      {
        x: satellite.orbitCenter.x + offset.x,
        y: satellite.orbitCenter.y + offset.y,
      },
      SATELLITE.BOUNDARY_RADIUS
    );
    satellite.velocity = {
      x: satellite.position.x - prev.x,
      y: satellite.position.y - prev.y,
    };
  }

  private repositionNearTargets(satellite: SatelliteInternal, targets: SatelliteTarget[]): void {
    const living = targets.filter((target) => !target.exploding && target.health > 0);
    if (living.length > 0) {
      const pick = living[Math.floor(this.rng.random() * living.length)];
      if (pick) {
        const angle = this.rng.random() * Math.PI * 2;
        const radius = 220 + this.rng.random() * 180;
        satellite.orbitCenter = clampToRadius(
          {
            x: pick.position.x + Math.cos(angle) * radius,
            y: pick.position.y + Math.sin(angle) * radius,
          },
          SATELLITE.BOUNDARY_RADIUS * 0.7
        );
      }
    } else {
      satellite.orbitCenter = this.rng.randomPosition({ radius: SATELLITE.BOUNDARY_RADIUS });
    }
    satellite.orbitPhase = this.rng.random() * Math.PI * 2;
    const offset = figure8Offset(satellite.orbitPhase, satellite.orbitRadiusX, satellite.orbitRadiusY);
    satellite.position = clampToRadius(
      {
        x: satellite.orbitCenter.x + offset.x,
        y: satellite.orbitCenter.y + offset.y,
      },
      SATELLITE.BOUNDARY_RADIUS
    );
    satellite.velocity = { x: 0, y: 0 };
    satellite.shootCooldown = SATELLITE.SHOOT_INTERVAL_FRAMES;
  }

  private spawnSatellite(index: number, bounds: { radius: number }): SatelliteInternal {
    const orbitCenter = this.rng.randomPosition({
      radius: Math.min(bounds.radius, SATELLITE.BOUNDARY_RADIUS),
    });
    const orbitPhase = this.rng.random() * Math.PI * 2;
    const orbitRadiusX = SATELLITE.ORBIT_RADIUS;
    const orbitRadiusY = SATELLITE.ORBIT_RADIUS * 0.55;
    const offset = figure8Offset(orbitPhase, orbitRadiusX, orbitRadiusY);
    const position = clampToRadius(
      { x: orbitCenter.x + offset.x, y: orbitCenter.y + offset.y },
      SATELLITE.BOUNDARY_RADIUS
    );

    return {
      id: `server-sat-${index}`,
      name: SATELLITE_NAMES[index % SATELLITE_NAMES.length] ?? `Satellite-${index}`,
      position,
      velocity: { x: 0, y: 0 },
      angle: 0,
      exploding: false,
      color: SAUCER_HULL_COLOR,
      health: SATELLITE.HEALTH,
      maxHealth: SATELLITE.HEALTH,
      radius: SATELLITE.SIZE / 2,
      orbitCenter,
      orbitPhase,
      orbitRadiusX,
      orbitRadiusY,
      shootCooldown: 30 + (index % 4) * 20,
      explodeTime: 0,
      respawnTimer: 0,
      driftAngle: this.rng.random() * Math.PI * 2,
    };
  }

  private toPublic(satellite: SatelliteInternal): SatelliteData {
    return {
      id: satellite.id,
      name: satellite.name,
      position: { ...satellite.position },
      velocity: { ...satellite.velocity },
      angle: satellite.angle,
      exploding: satellite.exploding,
      color: satellite.color,
      health: satellite.health,
      maxHealth: satellite.maxHealth,
      radius: satellite.radius,
    };
  }
}
