import { expect, test } from 'vitest';
import { Ship } from '../src/ship';

test.concurrent('Ship Creation', () => {
  const testShip = new Ship();
  expect(testShip).toBeInstanceOf(Ship);
});

test.concurrent('Ship Die', () => {
  const testShip = new Ship();
  expect(testShip.dead).toBeFalsy();
  testShip.die();
  expect(testShip.dead).toBeTruthy();
});

test.concurrent('Ship setBlinkOn', () => {
  const testShip = new Ship();
  testShip.setBlinkOn();
  expect(testShip.blinkOn).toBeTruthy(); // All new ships blink
  testShip.blinkCount = 1; // Simulate odd count (no blink)
  testShip.setBlinkOn();
  expect(testShip.blinkOn).toBeFalsy();
});
