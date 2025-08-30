import { canvasManager } from '../../rendering/canvas';
import { spawnRoidFromEdge as spawnFromEdge } from '../../utils/roidSpawn';

// Re-export for backward compatibility
export const spawnRoidFromEdge = spawnFromEdge;

export function calculateSpawnCount(): number {
  const cvs = canvasManager.getCanvas();
  const width = cvs?.width ?? 800; // Default to 800 for tests and server environments
  return Math.min(6, Math.floor(width / 200));
}
