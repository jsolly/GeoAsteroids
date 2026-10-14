import type { AsteroidMaterial } from '../shared-types';
import { GAME } from './constants/gameplay';
import { CONTOUR_LOCK } from './contourLock';

export const NAVIGATION_SALVAGE = {
  frames: GAME.FPS * 20,
  captureRadius: 60,
  iceRepair: 12,
  metalCargo: 4,
} as const;
export function navigationCaptureRadius(frames: number | undefined) {
  return (frames ?? 0) > 0 ? NAVIGATION_SALVAGE.captureRadius : CONTOUR_LOCK.captureRadius;
}
export const TAP_SALVAGE_LABELS: Record<AsteroidMaterial, string> = {
  ice: 'REPAIR ICE',
  metal: 'METAL CARGO',
  rubble: 'SALVAGED FIBER',
  crystal: 'NAV CRYSTAL',
};
