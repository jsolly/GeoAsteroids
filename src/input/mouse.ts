import { playSound } from '../audio/Sound';
import type { Player } from '../entities/player/Player';
import { Ship } from '../entities/ship/Ship';
import { canvasManager } from '../rendering/canvas';
import { logger } from '../utils/Logger';
import { getPressedKeysForPlayer } from './keybindings';

/* =============
Mouse Input Handling
============= */

let isRightMouseDown = false;

// Helper function to update thrust state including mouse input
function updateThrustFromAllInputs(player: Player): void {
  const pressed = getPressedKeysForPlayer(player);
  const shouldThrust = pressed.has('Space') || pressed.has('ArrowUp') || isRightMouseDown;
  const currentlyThrusting = player.ship.thrusting;

  // Only update if the aggregate state has changed
  if (shouldThrust !== currentlyThrusting) {
    player.ship.thrusting = shouldThrust;
    if (shouldThrust) {
      if (!Ship.fxThrust.isPlaying()) {
        playSound(Ship.fxThrust);
      }
    } else {
      Ship.fxThrust.stop();
    }
  }
}

export function handleMouseMove(ev: MouseEvent, player: Player): void {
  if (player.lives <= 0 || player.ship.exploding) {
    return;
  }

  const canvas = canvasManager.getCanvas();
  if (!canvas) {
    return;
  }

  const rect = canvas.getBoundingClientRect();

  // Convert mouse coordinates from CSS pixels to canvas (device) pixels
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const mouseX = (ev.clientX - rect.left) * scaleX;
  const mouseY = (ev.clientY - rect.top) * scaleY;

  // Ship is rendered at screen center; compute angle from center to mouse.
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;

  // Game uses angle 0 = +x axis, positive angles rotate counter-clockwise,
  // and ship forward vector is (cos(angle), -sin(angle)). Therefore use atan2 of -(dy).
  const dx = mouseX - centerX;
  const dy = mouseY - centerY;
  const desiredAngle = Math.atan2(-dy, dx);

  player.ship.angle = desiredAngle;
}

export function handleMouseDown(ev: MouseEvent, player: Player): void {
  logger.debug('MOUSE', 'Mouse down event', {
    button: ev.button,
    playerId: player.id,
    lives: player.lives,
    exploding: player.ship.exploding,
  });
  if (player.lives <= 0 || player.ship.exploding) {
    logger.debug('MOUSE', 'Mouse down ignored - player dead or exploding', { playerId: player.id });
    return;
  }

  // 0: left, 2: right
  if (ev.button === 0) {
    logger.debug('MOUSE', 'Left mouse click - shooting', { playerId: player.id });
    player.ship.shoot();
  } else if (ev.button === 2) {
    isRightMouseDown = true;
    updateThrustFromAllInputs(player);
  }
}

export function handleMouseUp(ev: MouseEvent, player: Player): void {
  // Handle right-button release unconditionally to ensure cleanup even for dead/exploding players
  if (ev.button === 2) {
    isRightMouseDown = false;
    updateThrustFromAllInputs(player);
    return;
  }

  // Early return for dead/exploding players (only applies to non-right-button events)
  if (player.lives <= 0 || player.ship.exploding) {
    return;
  }

  if (ev.button === 0) {
    // Allow next laser shot on release (mirrors Space key previous behavior)
    player.ship.canShoot = true;
  }
}

export function preventContextMenu(ev: MouseEvent): void {
  ev.preventDefault();
}

export function isRightClickThrustActive(): boolean {
  return isRightMouseDown;
}
