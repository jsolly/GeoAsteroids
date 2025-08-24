import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { Player } from '../src/entities/player/Player';
import { Ship } from '../src/entities/ship/Ship';
import {
  handleMouseDown,
  handleMouseMove,
  handleMouseUp,
  preventContextMenu,
} from '../src/input/mouse';
import { canvasManager } from '../src/rendering/canvas';

let player: Player;
const mockPlay = vi.fn();

beforeEach(() => {
  // Set predictable viewport size used by canvasManager.initialize()
  Object.defineProperty(window, 'innerWidth', { value: 800, writable: true });
  Object.defineProperty(window, 'innerHeight', { value: 600, writable: true });

  // Create and mount a canvas element so canvasManager can find it
  const canvas = document.createElement('canvas');
  // JSDOM layout: mock bounding rect to align with (0,0)
  // Width/height will be set by canvasManager.initialize()
  canvas.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    width: canvas.width,
    height: canvas.height,
    right: 0,
    bottom: 0,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  document.body.appendChild(canvas);

  // Initialize canvas manager
  canvasManager.initialize();

  // Mock thrust sounds
  Ship.fxThrust.play = mockPlay;
  Ship.fxThrust.stop = mockPlay;

  player = new Player({ id: 'p1', name: 'Tester', type: 'local' });
});

afterEach(() => {
  vi.resetAllMocks();
  document.body.innerHTML = '';
});

test('mouse move sets ship angle toward cursor', () => {
  const canvas = canvasManager.getCanvas();
  expect(canvas).not.toBeNull();
  if (!canvas) {
    return;
  }

  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;

  // Move to the right of center => angle ~ 0
  const evRight = new MouseEvent('mousemove', { clientX: centerX + 50, clientY: centerY });
  handleMouseMove(evRight, player);
  expect(Math.abs(player.ship.angle - 0)).toBeLessThan(1e-6);

  // Move above center => angle ~ +PI/2
  const evUp = new MouseEvent('mousemove', { clientX: centerX, clientY: centerY - 50 });
  handleMouseMove(evUp, player);
  expect(Math.abs(player.ship.angle - Math.PI / 2)).toBeLessThan(1e-6);
});

test('left click fires shoot() and release resets canShoot', () => {
  const shootSpy = vi.spyOn(player.ship, 'shoot');
  const down = new MouseEvent('mousedown', { button: 0 });
  handleMouseDown(down, player);
  expect(shootSpy).toHaveBeenCalled();
  player.ship.canShoot = false;
  const up = new MouseEvent('mouseup', { button: 0 });
  handleMouseUp(up, player);
  expect(player.ship.canShoot).toBeTruthy();
});

test('right click toggles thrust with sound', () => {
  const down = new MouseEvent('mousedown', { button: 2 });
  handleMouseDown(down, player);
  expect(player.ship.thrusting).toBeTruthy();
  expect(mockPlay).toHaveBeenCalled();

  const up = new MouseEvent('mouseup', { button: 2 });
  handleMouseUp(up, player);
  expect(player.ship.thrusting).toBeFalsy();
  expect(mockPlay).toHaveBeenCalled();
});

test('preventContextMenu prevents default on right click', () => {
  const ev = new MouseEvent('contextmenu');
  const preventDefault = vi.fn();
  ev.preventDefault = preventDefault;
  preventContextMenu(ev);
  expect(preventDefault).toHaveBeenCalled();
});
