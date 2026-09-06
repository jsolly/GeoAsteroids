import { upsertThrustSource } from '../audio/gameSounds';
import { GAME, SHIP } from '../constants';
import type { Player } from '../entities/player/Player';
import { logger } from '../utils/Logger';

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

// Track pressed keys per-player to avoid cross-player/global interference (e.g., parallel tests)
const playerPressedKeys = new WeakMap<Player, Set<string>>();

export function getPressedKeysForPlayer(player: Player): Set<string> {
  let set = playerPressedKeys.get(player);
  if (!set) {
    set = new Set<string>();
    playerPressedKeys.set(player, set);
  }
  return set;
}

// Helper function to update thrust state based on aggregate key state.
// Thrust keys are ArrowUp and KeyW (Space is the fire key — see keyDown).
export function updateThrustFromKeys(player: Player): void {
  const pressed = getPressedKeysForPlayer(player);
  const shouldThrust = pressed.has('ArrowUp') || pressed.has('KeyW');
  const currentlyThrusting = player.ship.thrusting;

  logger.debug('KEYBINDINGS', 'updateThrustFromKeys', {
    pressedKeys: Array.from(pressed),
    shouldThrust,
    currentlyThrusting,
    hasArrowUp: pressed.has('ArrowUp'),
    hasKeyW: pressed.has('KeyW'),
    playerId: player.id,
    playerName: player.name,
  });

  // Only update if the aggregate state has changed
  if (shouldThrust !== currentlyThrusting) {
    logger.debug('KEYBINDINGS', 'Updating thrust state', {
      from: currentlyThrusting,
      to: shouldThrust,
    });
    player.ship.thrusting = shouldThrust;
    upsertThrustSource({
      id: player.id,
      thrusting: shouldThrust,
      position: player.ship.position,
    });
  } else {
    logger.debug('KEYBINDINGS', 'Thrust state unchanged', {
      thrusting: shouldThrust,
    });
  }
}

// Helper to set angular velocity from the aggregate turn-key state. Supports
// both arrow keys (ArrowLeft/ArrowRight) and WASD (KeyA/KeyD); opposing keys
// held together cancel out. Using the per-player pressed set (rather than the
// global `keys` map) keeps combinations correct across arrow/WASD mixes.
export function updateTurnFromKeys(player: Player): void {
  const pressed = getPressedKeysForPlayer(player);
  const turningLeft = pressed.has('ArrowLeft') || pressed.has('KeyA');
  const turningRight = pressed.has('ArrowRight') || pressed.has('KeyD');

  if (turningLeft && !turningRight) {
    player.ship.angularVelocity = TURN_SPEED_RAD_PER_FRAME;
  } else if (turningRight && !turningLeft) {
    player.ship.angularVelocity = -TURN_SPEED_RAD_PER_FRAME;
  } else {
    // Neither held, or both held (opposing turns cancel).
    player.ship.angularVelocity = 0;
  }
}

export function keyDown(ev: KeyboardEvent, player: Player): void {
  logger.debug('KEYBINDINGS', 'KeyDown called', {
    key: ev.code,
    playerLives: player.lives,
    shipExploding: player.ship.exploding,
  });

  if (player.lives > 0 && !player.ship.exploding) {
    if (ev.code in keys) {
      keys[ev.code] = true;
    }
    // Record pressed key for this player
    getPressedKeysForPlayer(player).add(ev.code);
    switch (ev.code) {
      case 'Space':
        // Space fires (classic Asteroids + the documented control scheme).
        // Thrust is ArrowUp / KeyW / right-mouse; see updateThrustFromKeys.
        player.ship.shoot();
        break;
      case 'KeyE':
        player.ship.empPulse();
        break;
      case 'ArrowLeft':
      case 'KeyA':
      case 'ArrowRight':
      case 'KeyD':
        logger.debug('KEYBINDINGS', 'Updating rotation', { key: ev.code });
        updateTurnFromKeys(player);
        break;
      case 'ArrowUp':
      case 'KeyW':
        logger.debug('KEYBINDINGS', 'Setting thrust', { key: ev.code });
        updateThrustFromKeys(player);
        break;
    }
  }
}

export function keyUp(ev: KeyboardEvent, player: Player): void {
  logger.debug('KEYBINDINGS', 'KeyUp called', {
    key: ev.code,
    playerLives: player.lives,
    shipExploding: player.ship.exploding,
  });

  // Always update keys state first
  if (ev.code in keys) {
    keys[ev.code] = false;
  }

  // Update per-player pressed keys set
  getPressedKeysForPlayer(player).delete(ev.code);

  logger.debug('KEYBINDINGS', 'After key removal', {
    remainingKeys: Array.from(getPressedKeysForPlayer(player)),
    globalKeys: { ...keys },
  });

  // Space is the fire key; on release simply re-arm the next shot (mirrors the
  // left-mouse behavior). Handled regardless of alive state so it never sticks.
  if (ev.code === 'Space') {
    player.ship.canShoot = true;
    return;
  }

  // Reconcile thrust/turn from the remaining held keys. Done regardless of
  // lives/exploding so releasing a key never leaves a dead ship stuck
  // thrusting or spinning. Both arrows and WASD funnel through the same
  // aggregate helpers.
  switch (ev.code) {
    case 'ArrowUp':
    case 'KeyW':
      updateThrustFromKeys(player);
      break;
    case 'ArrowLeft':
    case 'KeyA':
    case 'ArrowRight':
    case 'KeyD':
      updateTurnFromKeys(player);
      break;
  }
}
