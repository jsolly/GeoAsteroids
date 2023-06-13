// import { expect, test, vi, beforeEach, afterEach } from 'vitest';
// import { keyDown, keyUp } from '../src/keybindings.js';
// import { ship } from '../src/main.js';
// import { TURN_SPEED, FPS } from '../src/config.js';

// let mockShip;

// beforeEach(() => {
//   mockShip = {
//     shoot: vi.fn(),
//     dead: false,
//     rot: null,
//     thrusting: null,
//     canShoot: null,
//   };

//   vi.mock(ship, mockShip);
// });

// afterEach(() => {
//   // Restore the original functions after each test  vi.restoreAllMocks();
//   vi.restoreAllMocks();
// });

// test.concurrent('keyDown - Space', () => {
//   keyDown(new KeyboardEvent('keydown', { code: 'Space' }));
//   expect(mockShip.shoot).toHaveBeenCalledTimes(1);
// });

// test.concurrent('keyDown - ArrowLeft', () => {
//   keyDown(new KeyboardEvent('keydown', { code: 'ArrowLeft' }));
//   expect(mockShip.rot).toEqual(((-TURN_SPEED / 180) * Math.PI) / FPS);
// });

// test.concurrent('keyDown - ArrowUp', () => {
//   keyDown(new KeyboardEvent('keydown', { code: 'ArrowUp' }));
//   expect(mockShip.thrusting).toBeTruthy();
// });

// test.concurrent('keyDown - ArrowRight', () => {
//   keyDown(new KeyboardEvent('keydown', { code: 'ArrowRight' }));
//   expect(mockShip.rot).toEqual(((TURN_SPEED / 180) * Math.PI) / FPS);
// });

// test.concurrent('keyUp - Space', () => {
//   keyUp(new KeyboardEvent('keyup', { code: 'Space' }));
//   expect(mockShip.canShoot).toBeTruthy();
// });

// test.concurrent('keyUp - ArrowLeft', () => {
//   keyUp(new KeyboardEvent('keyup', { code: 'ArrowLeft' }));
//   expect(mockShip.rot).toEqual(0);
// });

// test.concurrent('keyUp - ArrowUp', () => {
//   keyUp(new KeyboardEvent('keyup', { code: 'ArrowUp' }));
//   expect(mockShip.thrusting).toBeFalsy();
// });

// test.concurrent('keyUp - ArrowRight', () => {
//   keyUp(new KeyboardEvent('keyup', { code: 'ArrowRight' }));
//   expect(mockShip.rot).toEqual(0);
// });
