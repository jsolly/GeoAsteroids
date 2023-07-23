import { FPS, TURN_SPEED } from './config';
import { Ship } from './ship';
import { GameController } from './gameController';
document.addEventListener('keydown', (ev) =>
  keyDown(ev, GameController.getInstance().getCurrShip()),
);
document.addEventListener('keyup', (ev) =>
  keyUp(ev, GameController.getInstance().getCurrShip()),
);

interface KeyStates {
  ArrowLeft: boolean;
  ArrowRight: boolean;
  [key: string]: boolean;
}

const keys: KeyStates = {
  ArrowLeft: false,
  ArrowRight: false,
};

function keyDown(ev: KeyboardEvent, ship: Ship): void {
  if (!ship.dead) {
    if (ev.code in keys) {
      keys[ev.code] = true;
    }
    switch (ev.code) {
      case 'Space':
        ship.shoot();
        break;
      case 'ArrowLeft':
        ship.rot = ((-TURN_SPEED / 180) * Math.PI) / FPS;
        break;
      case 'ArrowUp':
        ship.thrusting = true;
        if (!Ship.fxThrust.isPlaying()) {
          Ship.fxThrust.play();
        }
        break;
      case 'ArrowRight':
        ship.rot = ((TURN_SPEED / 180) * Math.PI) / FPS;
        break;
    }
  }
}

function keyUp(ev: KeyboardEvent, ship: Ship): void {
  if (!ship.dead) {
    if (ev.code in keys) {
      keys[ev.code] = false;
    }
    switch (ev.code) {
      case 'Space':
        ship.canShoot = true;
        break;
      case 'ArrowLeft':
        if (!keys.ArrowRight) {
          ship.rot = 0;
        } else {
          ship.rot = ((TURN_SPEED / 180) * Math.PI) / FPS; // If right arrow is still down, continue rotation
        }
        break;
      case 'ArrowUp':
        ship.thrusting = false;
        Ship.fxThrust.stop();
        break;
      case 'ArrowRight':
        if (!keys.ArrowLeft) {
          ship.rot = 0;
        } else {
          ship.rot = ((-TURN_SPEED / 180) * Math.PI) / FPS; // If left arrow is still down, continue rotation
        }
        break;
    }
  }
}

export { keyDown, keyUp };
