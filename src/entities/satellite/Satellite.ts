import type { Position, SatelliteData, Velocity } from '../../../shared-types';
import { SATELLITE } from '../../constants';
import type { Laser } from '../laser/Laser';

export class Satellite {
  id: string;
  name: string;
  position: Position;
  velocity: Velocity;
  angle: number;
  exploding: boolean;
  color: string;
  health: number;
  maxHealth: number;
  radius: number;
  explodeTime: number;
  lasers: Laser[] = [];

  constructor(data: SatelliteData) {
    this.id = data.id;
    this.name = data.name;
    this.position = { ...data.position };
    this.velocity = { ...data.velocity };
    this.angle = data.angle;
    this.exploding = data.exploding;
    this.color = data.color;
    this.health = data.health;
    this.maxHealth = data.maxHealth;
    this.radius = data.radius;
    this.explodeTime = data.exploding ? SATELLITE.EXPLODE_DURATION_FRAMES : 0;
  }

  updateFromServer(data: SatelliteData): void {
    this.name = data.name;
    this.position = { ...data.position };
    this.velocity = { ...data.velocity };
    this.angle = data.angle;
    this.color = data.color;
    this.health = data.health;
    this.maxHealth = data.maxHealth;
    this.radius = data.radius;
    if (data.exploding && !this.exploding) {
      this.explodeTime = SATELLITE.EXPLODE_DURATION_FRAMES;
    }
    this.exploding = data.exploding;
  }

  update(): void {
    this.moveLasers();
    if (this.exploding && this.explodeTime > 0) {
      this.explodeTime -= 1;
    }
  }

  private moveLasers(): void {
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const laser = this.lasers[i];
      if (laser === undefined) {
        continue;
      }
      laser.move();
      if (laser.shouldBeRemoved()) {
        this.lasers.splice(i, 1);
      }
    }
  }
}
