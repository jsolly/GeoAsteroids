import { getCVS, ROID_SIZE } from '../../constants';
import { Vector } from '../../physics/Vector';

export function spawnAsteroidFromEdge(): Vector {
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

  return new Vector(x, y);
}

export function calculateSpawnCount(): number {
  const cvs = getCVS();
  const width = cvs?.width ?? 800; // Default to 800 for tests and server environments
  return Math.min(6, Math.floor(width / 200));
}

export function calculateMultiplayerReductionFactor(playerCount: number): number {
  if (playerCount >= 5) {
    return 0.3; // 30% of normal for 5+ players
  } else if (playerCount >= 3) {
    return 0.35; // 35% of normal for 3-4 players
  }
  return 0.4; // Base 40% reduction
}

export function calculateTargetAsteroidCount(
  currentCount: number,
  reductionFactor: number
): number {
  return Math.max(2, Math.floor(currentCount * reductionFactor));
}
