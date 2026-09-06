import type { Position, SatellitePickupData, SatellitePickupState, Velocity } from '../../../shared-types';

export class SatellitePickup {
  id: string;
  name: string;
  position: Position;
  velocity: Velocity;
  angle: number;
  radius: number;
  color: string;
  state: SatellitePickupState;
  ownerId: string | null;
  shieldFramesRemaining: number;

  constructor(data: SatellitePickupData) {
    this.id = data.id;
    this.name = data.name;
    this.position = { ...data.position };
    this.velocity = { ...data.velocity };
    this.angle = data.angle;
    this.radius = data.radius;
    this.color = data.color;
    this.state = data.state;
    this.ownerId = data.ownerId;
    this.shieldFramesRemaining = data.shieldFramesRemaining;
  }

  updateFromServer(data: SatellitePickupData): void {
    this.name = data.name;
    this.position = { ...data.position };
    this.velocity = { ...data.velocity };
    this.angle = data.angle;
    this.radius = data.radius;
    this.color = data.color;
    this.state = data.state;
    this.ownerId = data.ownerId;
    this.shieldFramesRemaining = data.shieldFramesRemaining;
  }
}
