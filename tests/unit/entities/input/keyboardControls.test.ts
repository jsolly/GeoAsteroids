import { beforeEach, expect, test, vi } from 'vitest';
import { GAME, SHIP } from '../../../../src/constants';
import { Player } from '../../../../src/entities/player/Player';
import { MockPlayerInput } from '../../../../src/input/MockPlayerInput';
import { keyDown, keyUp } from '../../../../src/input/keybindings';

// Covers the "controls appeared unresponsive" report: WASD did nothing and
// Space did not fire. Movement now supports WASD alongside the arrow keys, and
// Space is the fire key (matching the documented "thrust = arrows, fire =
// Space" scheme), so keyboard-only players can move AND shoot.

const TURN = ((SHIP.TURN_SPEED / 180) * Math.PI) / GAME.FPS;

let player: Player;

const press = (code: string): void => keyDown(new KeyboardEvent('keydown', { code }), player);
const release = (code: string): void => keyUp(new KeyboardEvent('keyup', { code }), player);

beforeEach(() => {
  player = new Player({ id: 'p', name: 'P', type: 'local', input: new MockPlayerInput() });
});

test('KeyW thrusts and releasing it stops thrust', () => {
  press('KeyW');
  expect(player.ship.thrusting).toBe(true);
  release('KeyW');
  expect(player.ship.thrusting).toBe(false);
});

test('KeyA turns left and KeyD turns right', () => {
  press('KeyA');
  expect(player.ship.angularVelocity).toBeCloseTo(TURN, 10);
  release('KeyA');
  expect(player.ship.angularVelocity).toBeCloseTo(0, 10);

  press('KeyD');
  expect(player.ship.angularVelocity).toBeCloseTo(-TURN, 10);
  release('KeyD');
  expect(player.ship.angularVelocity).toBeCloseTo(0, 10);
});

test('Space fires (calls shoot) and does not thrust', () => {
  const shootSpy = vi.spyOn(player.ship, 'shoot');
  press('Space');
  expect(shootSpy).toHaveBeenCalledTimes(1);
  expect(player.ship.thrusting).toBe(false);
});

test('Space creates a laser end-to-end', () => {
  expect(player.ship.lasers.length).toBe(0);
  press('Space');
  expect(player.ship.lasers.length).toBe(1);
});

test('releasing Space re-arms the next shot', () => {
  player.ship.canShoot = false;
  release('Space');
  expect(player.ship.canShoot).toBe(true);
});

test('opposing turn keys (arrow + WASD) cancel out', () => {
  press('ArrowLeft');
  press('KeyD');
  expect(player.ship.angularVelocity).toBeCloseTo(0, 10);
});

test('KeyE activates the ship kit ability', () => {
  const activateSpy = vi.spyOn(player.ship, 'activateAbility');
  press('KeyE');
  expect(activateSpy).toHaveBeenCalledTimes(1);
});

test('WASD is ignored while dead', () => {
  player.lives = 0;
  press('KeyW');
  press('KeyA');
  expect(player.ship.thrusting).toBe(false);
  expect(player.ship.angularVelocity).toBeCloseTo(0, 10);
});
