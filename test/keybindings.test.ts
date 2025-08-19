import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { FPS, TURN_SPEED } from '../src/constants';
import { Player } from '../src/entities/player/Player';
import { Ship } from '../src/entities/ship/Ship.ts';
import { keyDown, keyUp } from '../src/input/keybindings.ts';

let mockPlayer: Player;
const mockPlay = vi.fn();

const pressKey = (code: string): void => {
  const keyboardEvent = new KeyboardEvent('keydown', { code });
  keyDown(keyboardEvent, mockPlayer);
};

const releaseKey = (code: string): void => {
  const keyboardEvent = new KeyboardEvent('keyup', { code });
  keyUp(keyboardEvent, mockPlayer);
};

beforeEach(() => {
  Ship.fxThrust.play = mockPlay;
  Ship.fxThrust.stop = mockPlay;

  mockPlayer = new Player('test-player', 'TestPlayer', 3, false);
  mockPlayer.ship.fireLaser = vi.fn(() => {});
});

afterEach(() => {
  vi.resetAllMocks();
});

test('dummy test', () => {
  expect(1).toBe(1);
});

test('keyDown - Space', () => {
  pressKey('Space');
  expect(mockPlayer.ship.fireLaser).toHaveBeenCalled();
});

test('keyDown - ArrowLeft', () => {
  pressKey('ArrowLeft');
  expect(mockPlayer.ship.rot).toEqual(((TURN_SPEED / 180) * Math.PI) / FPS);
});

test('keyDown - ArrowUp', () => {
  pressKey('ArrowUp');
  expect(mockPlayer.ship.thrusting).toBeTruthy();
  expect(mockPlay).toHaveBeenCalled();
});

test('keyDown - ArrowRight', () => {
  pressKey('ArrowRight');
  expect(mockPlayer.ship.rot).toEqual(((-TURN_SPEED / 180) * Math.PI) / FPS);
  releaseKey('ArrowRight'); // For some reason, keyDown is persisting across tests
});

test('keyDown - Space', () => {
  pressKey('Space');
  expect(mockPlayer.ship.fireLaser).toHaveBeenCalled();
});

test('keyUp - ArrowLeft', () => {
  releaseKey('ArrowLeft');
  expect(mockPlayer.ship.rot).toEqual(0);
});

test('keyUp - ArrowUp', () => {
  releaseKey('ArrowUp');
  expect(mockPlayer.ship.thrusting).toBeFalsy();
  expect(mockPlay).toHaveBeenCalled();
});

test('keyUp - ArrowRight', () => {
  releaseKey('ArrowRight');
  expect(mockPlayer.ship.rot).toEqual(0);
});

test('keyUp - ArrowLeft with ArrowRight still down', () => {
  pressKey('ArrowRight');
  releaseKey('ArrowLeft');
  expect(mockPlayer.ship.rot).toEqual(((-TURN_SPEED / 180) * Math.PI) / FPS);
});

test('keyUp - ArrowRight with ArrowLeft still down', () => {
  pressKey('ArrowLeft');
  releaseKey('ArrowRight');
  expect(mockPlayer.ship.rot).toEqual(((TURN_SPEED / 180) * Math.PI) / FPS);
});

test('keyDown - non-specified key', () => {
  const initialRot = mockPlayer.ship.rot;
  const initialThrusting = mockPlayer.ship.thrusting;

  pressKey('KeyA');

  expect(mockPlayer.ship.rot).toEqual(initialRot);
  expect(mockPlayer.ship.thrusting).toEqual(initialThrusting);
  expect(mockPlay).not.toHaveBeenCalled();
});

test('keyDown - blocked when player is dead', () => {
  // Set player to have no lives (dead)
  mockPlayer.lives = 0;

  const initialRot = mockPlayer.ship.rot;
  const initialThrusting = mockPlayer.ship.thrusting;

  pressKey('Space');
  pressKey('ArrowLeft');
  pressKey('ArrowUp');

  // Input should be blocked when player is dead
  expect(mockPlayer.ship.fireLaser).not.toHaveBeenCalled();
  expect(mockPlayer.ship.rot).toEqual(initialRot);
  expect(mockPlayer.ship.thrusting).toEqual(initialThrusting);
  expect(mockPlay).not.toHaveBeenCalled();
});

test('keyUp - non-specified key', () => {
  const initialRot = mockPlayer.ship.rot;
  const initialThrusting = mockPlayer.ship.thrusting;

  releaseKey('KeyA');

  expect(mockPlayer.ship.rot).toEqual(initialRot);
  expect(mockPlayer.ship.thrusting).toEqual(initialThrusting);
  expect(mockPlay).not.toHaveBeenCalled();
});
