import { expect, test, vi, beforeEach, afterEach } from 'vitest';
import { Ship } from '../src/ship';
import { Vector } from '../src/vector';
import { LASER_MAX } from '../src/constants';

let mockShip: Ship;

beforeEach(() => {
  mockShip = new Ship();
});

afterEach(() => {
  vi.clearAllMocks();
});

test('Ship Creation', () => {
  expect(mockShip).toBeInstanceOf(Ship);
  expect(mockShip.lives).toBe(3);
  expect(mockShip.dead).toBe(false);
});

test('Move Ship', () => {
  mockShip.velocity = new Vector(1, 1);
  mockShip.move();
  expect(mockShip.position.x).toBeGreaterThan(0);
  expect(mockShip.position.y).toBeGreaterThan(0);
});

test('Ship Slows Down (Friction)', () => {
  mockShip.velocity = new Vector(1, 1);
  mockShip.thrusting = false;
  mockShip.move();
  expect(mockShip.velocity.x).toBeLessThan(1);
  expect(mockShip.velocity.y).toBeLessThan(1);
});

test('Ship Can Shoot', () => {
  mockShip.lasers = [];
  expect(mockShip.canShoot).toBeTruthy();
});

test('Ship Cannot Shoot', () => {
  const mockLaser = {
    position: new Vector(0, 0),
    velocity: new Vector(0, 0),
    distTraveled: 0,
    explodeTime: 0,
  };
  mockShip.lasers = Array(LASER_MAX).fill(mockLaser) as typeof mockShip.lasers;
  expect(mockShip.canShoot).toBeFalsy();
});
