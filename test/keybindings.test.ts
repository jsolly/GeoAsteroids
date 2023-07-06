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

test.concurrent('keyDown - Space', () => {
  keyDown(new KeyboardEvent('keydown', { code: 'Space' }), mockShip);
  expect(mockShip.fireLaser).toHaveBeenCalled();
});

test.concurrent('keyDown - ArrowLeft', () => {
  keyDown(new KeyboardEvent('keydown', { code: 'ArrowLeft' }), mockShip);
  expect(mockShip.rot).toEqual(((-TURN_SPEED / 180) * Math.PI) / FPS);
});

test.concurrent('keyDown - ArrowUp', () => {
  keyDown(new KeyboardEvent('keydown', { code: 'ArrowUp' }), mockShip);
  expect(mockShip.thrusting).toBeTruthy();
  expect(mockPlay).toHaveBeenCalled();
});

test.concurrent('keyDown - ArrowRight', () => {
  keyDown(new KeyboardEvent('keydown', { code: 'ArrowRight' }), mockShip);
  expect(mockShip.rot).toEqual(((TURN_SPEED / 180) * Math.PI) / FPS);
});

test.concurrent('keyUp - Space', () => {
  keyUp(new KeyboardEvent('keyup', { code: 'Space' }), mockShip);
  expect(mockShip.fireLaser).not.toHaveBeenCalled();
});

test.concurrent('keyUp - ArrowLeft', () => {
  keyUp(new KeyboardEvent('keyup', { code: 'ArrowLeft' }), mockShip);
  expect(mockShip.rot).toEqual(0);
});

test.concurrent('keyUp - ArrowUp', () => {
  keyUp(new KeyboardEvent('keyup', { code: 'ArrowUp' }), mockShip);
  expect(mockShip.thrusting).toBeFalsy();
  expect(mockPlay).toHaveBeenCalled();
});

test.concurrent('keyUp - ArrowRight', () => {
  keyUp(new KeyboardEvent('keyup', { code: 'ArrowRight' }), mockShip);
  expect(mockShip.rot).toEqual(0);
});

test.concurrent('keyUp - ArrowLeft with ArrowRight still down', () => {
  // Simulate ArrowRight key being down
  keyDown(new KeyboardEvent('keydown', { code: 'ArrowRight' }), mockShip);

  // Then simulate releasing ArrowLeft
  keyUp(new KeyboardEvent('keyup', { code: 'ArrowLeft' }), mockShip);

  expect(mockShip.rot).toEqual(((TURN_SPEED / 180) * Math.PI) / FPS); // rotation should continue
});

test.concurrent('keyUp - ArrowRight with ArrowLeft still down', () => {
  // Simulate ArrowLeft key being down
  keyDown(new KeyboardEvent('keydown', { code: 'ArrowLeft' }), mockShip);

  // Then simulate releasing ArrowRight
  keyUp(new KeyboardEvent('keyup', { code: 'ArrowRight' }), mockShip);

  expect(mockShip.rot).toEqual(((-TURN_SPEED / 180) * Math.PI) / FPS); // rotation should continue
});

test.concurrent('keyDown - non-specified key', () => {
  const initialRot = mockShip.rot;
  const initialThrusting = mockShip.thrusting;

  keyDown(new KeyboardEvent('keydown', { code: 'KeyA' }), mockShip);

  expect(mockShip.rot).toEqual(initialRot);
  expect(mockShip.thrusting).toEqual(initialThrusting);
  expect(mockPlay).not.toHaveBeenCalled();
});

test.concurrent('keyUp - non-specified key', () => {
  const initialRot = mockShip.rot;
  const initialThrusting = mockShip.thrusting;

  keyUp(new KeyboardEvent('keyup', { code: 'KeyA' }), mockShip);

  expect(mockShip.rot).toEqual(initialRot);
  expect(mockShip.thrusting).toEqual(initialThrusting);
  expect(mockPlay).not.toHaveBeenCalled();
});
