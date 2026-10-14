import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { LOCAL_STORAGE_KEYS } from '../../../../src/constants/user-preferences';
import { Player } from '../../../../src/entities/player/Player';
import { resetControlSources } from '../../../../src/input/controlSources';
import { reconcilePlayerInput } from '../../../../src/input/keybindings';

import {
  handleMouseDown,
  handleMouseMove,
  handleMouseUp,
  preventContextMenu,
} from '../../../../src/input/mouse';
import { canvasManager } from '../../../../src/rendering/canvasSurface';

let player: Player;
let testCanvas: HTMLCanvasElement;

beforeEach(() => {
  resetControlSources();
  localStorage.setItem(LOCAL_STORAGE_KEYS.soundOn, 'true');
  vi.stubGlobal('innerWidth', 800);
  vi.stubGlobal('innerHeight', 600);
  testCanvas = document.createElement('canvas');
  document.body.appendChild(testCanvas);
  canvasManager.initialize(testCanvas);
  vi.spyOn(testCanvas, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 800, 600));

  player = new Player({ id: 'p1', name: 'Tester', type: 'local' });
  reconcilePlayerInput(player);
});

afterEach(() => {
  resetControlSources();
  canvasManager.destroy();
  testCanvas.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test('mouse movement turns the ship toward the cursor at a capped rate', () => {
  const canvas = canvasManager.getCanvas();
  expect(canvas).not.toBeNull();
  if (!canvas) {
    throw new Error('Canvas unavailable');
  }

  const viewport = canvasManager.getViewportSize();
  const centerX = viewport.width / 2;
  const centerY = viewport.height / 2;

  // Move to the right of center => angle ~ 0
  const evRight = new MouseEvent('mousemove', { clientX: centerX + 50, clientY: centerY });
  handleMouseMove(evRight, player);
  expect(player.ship.angle).toBeCloseTo(Math.PI / 2);
  for (let frame = 0; frame < 20; frame++) {
    reconcilePlayerInput(player);
    player.ship.update();
  }
  expect(Math.abs(player.ship.angle)).toBeLessThan(1e-6);

  // Move above center => angle ~ +PI/2
  const evUp = new MouseEvent('mousemove', { clientX: centerX, clientY: centerY - 50 });
  handleMouseMove(evUp, player);
  expect(player.ship.angle).toBeCloseTo(0);
  for (let frame = 0; frame < 20; frame++) {
    reconcilePlayerInput(player);
    player.ship.update();
  }
  expect(Math.abs(player.ship.angle - Math.PI / 2)).toBeLessThan(1e-6);
});

test('left click fires once and release re-arms without interrupting cruise', () => {
  const shoot = vi.spyOn(player.ship, 'shoot');
  handleMouseDown(new MouseEvent('mousedown', { button: 0 }), player);
  expect(shoot).toHaveBeenCalledOnce();
  expect(player.ship.canShoot).toBe(false);
  expect(player.ship.lasers).toHaveLength(1);
  handleMouseUp(new MouseEvent('mouseup', { button: 0 }), player);
  expect(player.ship.canShoot).toBe(true);
  expect(player.ship.thrusting).toBe(true);
});

test('right click toggles contour lock once per press without firing or interrupting cruise', () => {
  const toggle = vi.spyOn(player.ship, 'toggleContourLock').mockImplementation(() => {
    player.ship.contourLock = player.ship.contourLocked ? null : { height: 0.1, direction: 1 };
    return player.ship.contourLocked;
  });
  const shoot = vi.spyOn(player.ship, 'shoot');
  expect(player.ship.contourLocked).toBe(false);
  handleMouseDown(new MouseEvent('mousedown', { button: 2 }), player);
  expect(toggle).toHaveBeenCalledOnce();
  expect(player.ship.contourLocked).toBe(true);
  expect(player.ship.thrusting).toBe(true);
  expect(shoot).not.toHaveBeenCalled();

  handleMouseUp(new MouseEvent('mouseup', { button: 2 }), player);
  expect(toggle).toHaveBeenCalledOnce();
  expect(player.ship.contourLocked).toBe(true);
  expect(player.ship.thrusting).toBe(true);

  handleMouseDown(new MouseEvent('mousedown', { button: 2 }), player);
  expect(toggle).toHaveBeenCalledTimes(2);
  expect(player.ship.contourLocked).toBe(false);
});

test('preventContextMenu prevents default on right click', () => {
  const ev = new MouseEvent('contextmenu');
  const preventDefault = vi.fn();
  ev.preventDefault = preventDefault;
  preventContextMenu(ev);
  expect(preventDefault).toHaveBeenCalled();
});
