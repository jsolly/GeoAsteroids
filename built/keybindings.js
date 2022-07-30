import {ship} from './ship.js';
import {TURN_SPEED, FPS} from './constants.js';
import {shootLaser} from './lasers.js';
/**
 *
 * @param {string} ev - Event fired when key is pressed down
 * @return {boolean} False if ship is dead @todo I think this is wrong
 */
function keyDown(ev) {
  if (ship.dead) {
    return false;
  }
  switch (ev.code) {
    case 'Space': // Shoot laser
      shootLaser();
      break;
    case 'ArrowLeft': // left arrow (rotate ship left)
      ship.rot = ((-TURN_SPEED / 180) * Math.PI) / FPS;
      break;
    case 'ArrowUp': // up arrow (thrust the ship forward)
      ship.thrusting = true;
      break;
    case 'ArrowRight': // right arrow (rotate ship right)
      ship.rot = ((TURN_SPEED / 180) * Math.PI) / FPS;
      break;
  }
}
/**
 *
 * @param {string} ev - Event fired when key is released
 * @return {False} if ship is dead @todo I think this is wrong
 */
function keyUp(ev) {
  if (ship.dead) {
    return false;
  }
  switch (ev.code) {
    case 'Space': // Allow shooting
      ship.canShoot = true;
      break;
    case 'ArrowLeft': // Release left arrow. (stop rotating ship left)
      ship.rot = 0;
      break;
    case 'ArrowUp': // Release up arrow. (stop thrusting the ship forward)
      ship.thrusting = false;
      break;
    case 'ArrowRight': // Release right arrow (stop rotating ship right)
      ship.rot = 0;
      break;
  }
}
export {keyUp, keyDown};
