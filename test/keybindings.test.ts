import { expect, test, vi, beforeEach, afterEach } from 'vitest';
import { keyDown, keyUp } from '../src/keybindings.js';
import { TURN_SPEED, FPS } from '../src/config.js';
import { Ship } from '../src/ship.js';

let mockShip: Ship;

const mockPlay = vi.fn();

beforeEach(() => {
  Ship.fxThrust.play = mockPlay;
  Ship.fxThrust.stop = mockPlay;
  mockShip = new Ship();
  mockShip.fireLaser = vi.fn(() => {
    console.log('Mock fireLaser called');
  });

  mockShip.rot = 0;
  mockShip.thrusting = false;
});

afterEach(() => {
  // Restore the original functions after each test
  vi.restoreAllMocks();
  mockShip = new Ship();
});

const pressKey = (code: string): void =>
  keyDown(new KeyboardEvent('keydown', { code }), mockShip);
const releaseKey = (code: string): void =>
  keyUp(new KeyboardEvent('keyup', { code }), mockShip);

test.concurrent('keyDown - Space', () => {
  pressKey('Space');
  expect(mockShip.fireLaser).toHaveBeenCalled();
});

test.concurrent('keyDown - ArrowLeft', () => {
  pressKey('ArrowLeft');
  expect(mockShip.rot).toEqual(((-TURN_SPEED / 180) * Math.PI) / FPS);
});

test.concurrent('keyDown - ArrowUp', () => {
  pressKey('ArrowUp');
  expect(mockShip.thrusting).toBeTruthy();
  expect(mockPlay).toHaveBeenCalled();
});

test.concurrent('keyDown - ArrowRight', () => {
  pressKey('ArrowRight');
  expect(mockShip.rot).toEqual(((TURN_SPEED / 180) * Math.PI) / FPS);
});

test.concurrent('keyUp - Space', () => {
  releaseKey('Space');
  expect(mockShip.fireLaser).not.toHaveBeenCalled();
});

test.concurrent('keyUp - ArrowLeft', () => {
  releaseKey('ArrowLeft');
  expect(mockShip.rot).toEqual(0);
});

test.concurrent('keyUp - ArrowUp', () => {
  releaseKey('ArrowUp');
  expect(mockShip.thrusting).toBeFalsy();
  expect(mockPlay).toHaveBeenCalled();
});

test.concurrent('keyUp - ArrowRight', () => {
  releaseKey('ArrowRight');
  expect(mockShip.rot).toEqual(0);
});

test.concurrent('keyUp - ArrowLeft with ArrowRight still down', () => {
  pressKey('ArrowRight');
  releaseKey('ArrowLeft');
  expect(mockShip.rot).toEqual(((TURN_SPEED / 180) * Math.PI) / FPS);
});

test.concurrent('keyUp - ArrowRight with ArrowLeft still down', () => {
  pressKey('ArrowLeft');
  releaseKey('ArrowRight');
  expect(mockShip.rot).toEqual(((-TURN_SPEED / 180) * Math.PI) / FPS);
});

test.concurrent('keyDown - non-specified key', () => {
  const initialRot = mockShip.rot;
  const initialThrusting = mockShip.thrusting;

  pressKey('KeyA');

  expect(mockShip.rot).toEqual(initialRot);
  expect(mockShip.thrusting).toEqual(initialThrusting);
  expect(mockPlay).not.toHaveBeenCalled();
});

test.concurrent('keyUp - non-specified key', () => {
  const initialRot = mockShip.rot;
  const initialThrusting = mockShip.thrusting;

  releaseKey('KeyA');

  expect(mockShip.rot).toEqual(initialRot);
  expect(mockShip.thrusting).toEqual(initialThrusting);
  expect(mockPlay).not.toHaveBeenCalled();
});
