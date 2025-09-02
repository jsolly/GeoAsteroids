import { canvasManager } from '../../rendering/canvas';
// This file is no longer needed since roidSpawn was removed
// The functionality has been moved to the server

export function calculateSpawnCount(): number {
  const cvs = canvasManager.getCanvas();
  const width = cvs?.width ?? 800; // Default to 800 for tests and server environments
  return Math.min(6, Math.floor(width / 200));
}
