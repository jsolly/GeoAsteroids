import { expect, test, vi, beforeEach, afterEach } from 'vitest';
import { keyDown, keyUp } from '../src/keybindings';
import { TURN_SPEED, FPS } from '../src/constants';
import { Ship } from '../src/ship';

let mockShip: Ship;
const mockPlay = vi.fn();

const pressKey = (code: string): void => {
  const keyboardEvent = new KeyboardEvent('keydown', { code });
  keyDown(keyboardEvent, mockShip);
};

const releaseKey = (code: string): void => {
  const keyboardEvent = new KeyboardEvent('keyup', { code });
  keyUp(keyboardEvent, mockShip);
};

beforeEach(() => {
  Ship.fxThrust.play = mockPlay;
  Ship.fxThrust.stop = mockPlay;

  mockShip = new Ship();
  mockShip.fireLaser = vi.fn(() => {
    console.log('Mock fireLaser called');
  });
});

afterEach(() => {
  vi.resetAllMocks();
});

test('dummy test', () => {
  expect(1).toBe(1);
});

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
  releaseKey('ArrowRight'); // For some reason, keyDown is persisting across tests
});

test.concurrent('keyDown - Space', () => {
  pressKey('Space');
  expect(mockShip.fireLaser).toHaveBeenCalled();
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
