import type { FuelDropData, Position, Velocity } from '../../../shared-types';
import { FUEL } from '../../constants';

export class FuelDrop {
  id: string;
  position: Position;
  velocity: Velocity;
  amount: number;
  r: number;

  constructor(data: FuelDropData) {
    this.id = data.id;
    this.position = { x: data.position.x, y: data.position.y };
    this.velocity = { x: data.velocity.x, y: data.velocity.y };
    this.amount = data.amount;
    this.r = data.radius;
  }

  static fromData(data: FuelDropData): FuelDrop {
    return new FuelDrop(data);
  }

  static createAt(
    id: string,
    position: Position,
    amount: number = FUEL.DROP_AMOUNT,
    radius: number = FUEL.DROP_RADIUS
  ): FuelDrop {
    return new FuelDrop({
      id,
      position,
      velocity: { x: 0, y: 0 },
      amount,
      radius,
    });
  }
}
