import type { Position } from '../../../shared-types';
import { ROID_SIZE } from '../../constants/entities/roid';
import { canvasManager } from '../../rendering/canvas';

export function spawnRoidFromEdge(): Position {
  // Get the current canvas dimensions for full-screen spawning
  const canvasWidth = window.innerWidth;
  const canvasHeight = window.innerHeight;

  // Randomly choose which edge to spawn from (0-3: top, right, bottom, left)
  const edge = Math.floor(Math.random() * 4);
  let x: number;
  let y: number;

  switch (edge) {
    case 0: {
      // Top edge
      x = Math.random() * canvasWidth;
      y = -ROID_SIZE; // Just above the screen
      break;
    }
    case 1: {
      // Right edge
      x = canvasWidth + ROID_SIZE; // Just right of the screen
      y = Math.random() * canvasHeight;
      break;
    }
    case 2: {
      // Bottom edge
      x = Math.random() * canvasWidth;
      y = canvasHeight + ROID_SIZE; // Just below the screen
      break;
    }
    case 3: {
      // Left edge
      x = -ROID_SIZE; // Just left of the screen
      y = Math.random() * canvasHeight;
      break;
    }
    default: {
      // Use center-based positioning as fallback
      const centerX = canvasWidth / 2;
      const centerY = canvasHeight / 2;
      const direction = Math.random() < 0.5 ? 1 : -1;
      x = centerX + ROID_SIZE * 4 * direction;
      y = centerY + ROID_SIZE * 4 * direction;
      break;
    }
  }

  return { x, y };
}

export function calculateSpawnCount(): number {
  const cvs = canvasManager.getCanvas();
  const width = cvs?.width ?? 800; // Default to 800 for tests and server environments
  return Math.min(6, Math.floor(width / 200));
}
