import { FPS, TURN_SPEED } from './config.js';
import { Ship } from './ship.js';
/**
 *
 * @param ev - Event fired when key is pressed down
 * @param ship - The ship object to be controlled
 * @returns False if ship is dead
 */
function keyDown(ev: KeyboardEvent, ship: Ship): void {
  if (!ship.dead) {
    switch (ev.code) {
      case 'Space':
        ship.shoot();
        break;
      case 'ArrowLeft': // left arrow (rotate ship left)
        ship.rot = ((-TURN_SPEED / 180) * Math.PI) / FPS;
        break;
      case 'ArrowUp': // up arrow (thrust the ship forward)
        ship.thrusting = true;
        if (!Ship.fxThrust.isPlaying()) {
          Ship.fxThrust.play();
        }
        break;
      case 'ArrowRight': // right arrow (rotate ship right)
        ship.rot = ((TURN_SPEED / 180) * Math.PI) / FPS;
        break;
    }
  }
}
/**
 *
 * @param ev - Event fired when key is released
 * @param ship - The ship object to be controlled
 * @returns False if ship is dead
 */
function keyUp(ev: KeyboardEvent, ship: Ship): void {
  if (!ship.dead) {
    switch (ev.code) {
      case 'Space': // Allow shooting
        ship.canShoot = true;
        break;
      case 'ArrowLeft': // Release left arrow. (stop rotating ship left)
        ship.rot = 0;
        break;
      case 'ArrowUp': // Release up arrow. (stop thrusting the ship forward)
        ship.thrusting = false;
        Ship.fxThrust.stop();
        break;
      case 'ArrowRight': // Release right arrow (stop rotating ship right)
        ship.rot = 0;
        break;
    }
  }
}

export { keyDown, keyUp };
