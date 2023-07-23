import { expect, test, vi, beforeEach, afterEach } from 'vitest';
import { keyDown, keyUp } from '../src/keybindings';
import { TURN_SPEED, FPS } from '../src/constants';
import { Ship } from '../src/ship';
import { GameController } from '../src/gameController';

let mockShip: Ship;
const gameController = GameController.getInstance();

const mockPlay = vi.fn();

beforeEach(() => {
  Ship.fxThrust.play = mockPlay;
  Ship.fxThrust.stop = mockPlay;
  mockShip = gameController.getCurrShip();
  mockShip.fireLaser = vi.fn();

  mockShip.rot = 0;
  mockShip.thrusting = false;
});

afterEach(() => {
  // Restore the original functions after each test
  vi.restoreAllMocks();
  gameController.newGame();
});

const pressKey = (code: string): void =>
  keyDown(new KeyboardEvent('keydown', { code }), mockShip);
const releaseKey = (code: string): void =>
  keyUp(new KeyboardEvent('keyup', { code }), mockShip);

test.concurrent('keyDown - Space', () => {
  pressKey('Space');
  expect(mockShip.fireLaser.bind(mockShip)).toHaveBeenCalled();
});

// Rest of the tests stay the same

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

test.concurrent('keyDown - Space', () => {
  pressKey('Space');
  expect(mockShip.fireLaser.bind(mockShip)).toHaveBeenCalled();
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
