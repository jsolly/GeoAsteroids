import type { AsteroidData, Position } from '../../shared-types';
export function asteroidRow(position: Position, size: number, id = 'test-rock'): AsteroidData {
  return {
    id,
    position,
    size,
    velocity: { x: 0, y: 0 },
    rotation: 0,
    angularVelocity: 0,
    health: size * 10,
    maxHealth: size * 10,
    jaggedness: 0.5,
    vertices: 8,
    offsets: [1, 1, 1, 1, 1, 1, 1, 1],
  };
}
