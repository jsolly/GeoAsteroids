import { ship } from "./ship.mjs";
import { TURN_SPEED, FPS } from "./constants.mjs";
import { shootLaser } from "./lasers.mjs";

/**
 *
 * @param {string} ev - Event fired when key is pressed down
 * @return {boolean} False if ship is dead @todo I think this is wrong
 */
function keyDown(/** @type {KeyboardEvent} */ ev) {
  if (ship.dead) {
    return false;
  }
  switch (ev.keyCode) {
    case 32: // Shoot laser
      shootLaser();
      break;

    case 37: // left arrow (rotate ship left)
      ship.rot = ((-TURN_SPEED / 180) * Math.PI) / FPS;
      break;
    case 38: // up arrow (thrust the ship forward)
      ship.thrusting = true;
      break;
    case 39: // right arrow (rotate ship right)
      ship.rot = ((TURN_SPEED / 180) * Math.PI) / FPS;
      break;
  }
}
/**
 *
 * @param {string} ev - Event fired when key is released
 * @return {False} if ship is dead @todo I think this is wrong
 */
function keyUp(/** @type {KeyboardEvent} */ ev) {
  if (ship.dead) {
    return false;
  }
  switch (ev.keyCode) {
    case 32: // Allow shooting
      ship.canShoot = true;
      break;
    case 37: // Release left arrow. (stop rotating ship left)
      ship.rot = 0;
      break;
    case 38: // Release up arrow. (stop thrusting the ship forward)
      ship.thrusting = false;
      break;
    case 39: // Release right arrow (stop rotating ship right)
      ship.rot = 0;
      break;
  }
}

export { keyUp, keyDown };
