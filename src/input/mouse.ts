import type { Player } from '../entities/player/Player';
import { Ship } from '../entities/ship/Ship';
import { canvasManager } from '../rendering/canvas';

/* =============
Mouse Input Handling
============= */

let isRightMouseDown = false;

export function handleMouseMove(ev: MouseEvent, player: Player): void {
  if (player.isDead || player.ship.exploding) {
    return;
  }

  const canvas = canvasManager.getCanvas();
  if (!canvas) {
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const mouseX = ev.clientX - rect.left;
  const mouseY = ev.clientY - rect.top;

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
  if (player.isDead || player.ship.exploding) {
    return;
  }

  // 0: left, 2: right
  if (ev.button === 0) {
    player.ship.shoot();
  } else if (ev.button === 2) {
    isRightMouseDown = true;
    player.ship.thrusting = true;
    // Start thrust sound if not playing (mirrors ArrowUp behavior)
    if (!Ship.fxThrust.isPlaying()) {
      Ship.fxThrust.play();
    }
  }
}

export function handleMouseUp(ev: MouseEvent, player: Player): void {
  if (player.isDead || player.ship.exploding) {
    return;
  }

  if (ev.button === 0) {
    // Allow next laser shot on release (mirrors Space key previous behavior)
    player.ship.canShoot = true;
  } else if (ev.button === 2) {
    isRightMouseDown = false;
    player.ship.thrusting = false;
    Ship.fxThrust.stop();
  }
}

export function preventContextMenu(ev: MouseEvent): void {
  ev.preventDefault();
}

export function isRightClickThrustActive(): boolean {
  return isRightMouseDown;
}
