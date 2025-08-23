import { TURN_SPEED } from '../constants/entities/ship';
import { FPS } from '../constants/physics';
import type { Player } from '../entities/player/types';
import { Ship } from '../entities/ship/Ship';

interface KeyStates {
  ArrowLeft: boolean;
  ArrowRight: boolean;
  [key: string]: boolean;
}

const keys: KeyStates = {
  ArrowLeft: false,
  ArrowRight: false,
};

export function keyDown(ev: KeyboardEvent, player: Player): void {
  if (!player.isDead && !player.ship.exploding) {
    if (ev.code in keys) {
      keys[ev.code] = true;
    }
    switch (ev.code) {
      case 'Space':
        player.ship.shoot();
        break;
      case 'KeyE':
        player.ship.empPulse();
        break;
      case 'ArrowLeft':
        player.ship.angularVelocity = ((TURN_SPEED / 180) * Math.PI) / FPS;
        break;
      case 'ArrowUp':
        player.ship.thrusting = true;
        if (!Ship.fxThrust.isPlaying()) {
          Ship.fxThrust.play();
        }
        break;
      case 'ArrowRight':
        player.ship.angularVelocity = ((-TURN_SPEED / 180) * Math.PI) / FPS;
        break;
    }
  }
}

export function keyUp(ev: KeyboardEvent, player: Player): void {
  // Always update keys state first
  if (ev.code in keys) {
    keys[ev.code] = false;
  }

  // Then check if player can respond to key events
  if (!player.isDead && !player.ship.exploding) {
    switch (ev.code) {
      case 'Space':
        player.ship.canShoot = true;
        break;
      case 'ArrowLeft':
        if (!keys.ArrowRight) {
          player.ship.angularVelocity = 0;
        } else {
          player.ship.angularVelocity = ((-TURN_SPEED / 180) * Math.PI) / FPS; // If right arrow is still down, continue rotation
        }
        break;
      case 'ArrowUp':
        player.ship.thrusting = false;
        Ship.fxThrust.stop();
        break;
      case 'ArrowRight':
        if (!keys.ArrowLeft) {
          player.ship.angularVelocity = 0;
        } else {
          player.ship.angularVelocity = ((TURN_SPEED / 180) * Math.PI) / FPS; // If left arrow is still down, continue rotation
        }
        break;
    }
  }
}
