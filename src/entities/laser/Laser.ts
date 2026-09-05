import type { Position, Velocity } from '../../../shared-types';
import { playSound, Sound } from '../../audio/Sound';
import { playWorldSound } from '../../audio/spatialAudio';
import { GAME, LASER } from '../../constants';
import { canvasManager } from '../../rendering/canvas';
import { getVelocityMagnitude } from '../../utils/mathUtils';

export interface LaserData {
  position: Position;
  velocity: Velocity;
  distTraveled: number;
  explodeTime: number;
  hasExploded: boolean;
}

export class Laser implements LaserData {
  static fxLaser: Sound = new Sound('sounds/laser.m4a', 5);
  static fxHit: Sound = new Sound('sounds/hit.m4a', 5);

  constructor(
    public position: Position,
    public velocity: Velocity,
    public distTraveled: number,
    public explodeTime: number,
    public hasExploded: boolean = false
  ) {}

  move(): void {
    if (this.explodeTime > 0) {
      this.explodeTime--;
    } else {
      this.position = {
        x: this.position.x + this.velocity.x,
        y: this.position.y + this.velocity.y,
      };
      this.distTraveled += getVelocityMagnitude(this.velocity);
    }
  }

  updateExplodeTime(): void {
    this.explodeTime = Math.ceil(LASER.EXPLODE_DURATION * GAME.FPS);
    this.hasExploded = true;
  }

  isExpired(): boolean {
    const cvs = canvasManager.getCanvas();
    if (!cvs) {
      return true; // Expire immediately if canvas is unavailable
    }
    return this.distTraveled >= LASER.TRAVEL_DISTANCE_RATIO + cvs.width;
  }

  shouldBeRemoved(): boolean {
    // Remove if traveled max distance OR finished exploding
    return this.isExpired() || (this.hasExploded && this.explodeTime <= 0);
  }

  playLaserSound(): void {
    playSound(Laser.fxLaser);
  }

  playHitSound(): void {
    playWorldSound(Laser.fxHit, this.position);
  }
}
