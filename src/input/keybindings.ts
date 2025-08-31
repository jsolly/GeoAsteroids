import { playSound } from '../audio/Sound';
import { GAME, SHIP } from '../constants';
import type { Player } from '../entities/player/Player';
import { Ship } from '../entities/ship/Ship';

const TURN_SPEED_RAD_PER_FRAME = (SHIP.TURN_SPEED * Math.PI) / (180 * GAME.FPS);

interface KeyStates {
  ArrowLeft: boolean;
  ArrowRight: boolean;
  Space: boolean;
  ArrowUp: boolean;
  [key: string]: boolean;
}

export const keys: KeyStates = {
  ArrowLeft: false,
  ArrowRight: false,
  Space: false,
  ArrowUp: false,
};

// Track whether we've started thrust sound to avoid relying on HTMLAudioElement state in tests
let thrustSoundActive = false;

// Track pressed keys per-player to avoid cross-player/global interference (e.g., parallel tests)
const playerPressedKeys = new WeakMap<Player, Set<string>>();

function getPressedKeysForPlayer(player: Player): Set<string> {
  let set = playerPressedKeys.get(player);
  if (!set) {
    set = new Set<string>();
    playerPressedKeys.set(player, set);
  }
  return set;
}

// Helper function to update thrust state based on aggregate key state
function updateThrustFromKeys(player: Player): void {
  const pressed = getPressedKeysForPlayer(player);
  const shouldThrust = pressed.has('Space') || pressed.has('ArrowUp');
  const currentlyThrusting = player.ship.thrusting;

  // Only update if the aggregate state has changed
  if (shouldThrust !== currentlyThrusting) {
    player.ship.thrusting = shouldThrust;
    if (shouldThrust) {
      if (!thrustSoundActive) {
        playSound(Ship.fxThrust);
        thrustSoundActive = true;
      }
    } else {
      Ship.fxThrust.stop();
      thrustSoundActive = false;
    }
  }
}

export function keyDown(ev: KeyboardEvent, player: Player): void {
  if (!player.isDead && !player.ship.exploding) {
    if (ev.code in keys) {
      keys[ev.code] = true;
    }
    // Record pressed key for this player
    getPressedKeysForPlayer(player).add(ev.code);
    switch (ev.code) {
      case 'Space':
        // Space now thrusts (in addition to right click). Keep arrows unchanged.
        updateThrustFromKeys(player);
        break;
      case 'KeyE':
        player.ship.empPulse();
        break;
      case 'ArrowLeft':
        player.ship.angularVelocity = TURN_SPEED_RAD_PER_FRAME;
        break;
      case 'ArrowUp':
        updateThrustFromKeys(player);
        break;
      case 'ArrowRight':
        player.ship.angularVelocity = -TURN_SPEED_RAD_PER_FRAME;
        break;
    }
  }
}

export function keyUp(ev: KeyboardEvent, player: Player): void {
  // Always update keys state first
  if (ev.code in keys) {
    keys[ev.code] = false;
  }

  // Update per-player pressed keys set
  getPressedKeysForPlayer(player).delete(ev.code);

  // Always handle Space key release to ensure thrust cleanup even if player cannot act
  if (ev.code === 'Space') {
    updateThrustFromKeys(player);
    return; // Exit early for Space to avoid any further state changes
  }

  // Then check if player can respond to key events
  if (!player.isDead && !player.ship.exploding) {
    switch (ev.code) {
      case 'Space':
        // Already handled above to ensure cleanup regardless of state
        break;
      case 'ArrowLeft':
        if (!keys.ArrowRight) {
          player.ship.angularVelocity = 0;
        } else {
          player.ship.angularVelocity = -TURN_SPEED_RAD_PER_FRAME; // If right arrow is still down, continue rotation
        }
        break;
      case 'ArrowUp':
        updateThrustFromKeys(player);
        break;
      case 'ArrowRight':
        if (!keys.ArrowLeft) {
          player.ship.angularVelocity = 0;
        } else {
          player.ship.angularVelocity = TURN_SPEED_RAD_PER_FRAME; // If left arrow is still down, continue rotation
        }
        break;
    }
  }

  // Note: updateThrustFromKeys() already handles all thrust state reconciliation
  // including sound management and aggregate key state checking
}
