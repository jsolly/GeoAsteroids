import { GAME } from './constants/gameplay';

export const CONTOUR_BRIDGE = {
  maximum: 64,
  comboWindowMs: 2000,
  hopLimit: 3,
  lifetimeFrames: GAME.FPS * 8,
  maximumLifetimeFrames: GAME.FPS * 20,
  catchRadius: 28,
  draftFrames: GAME.FPS * 2,
  draftMultiplier: 1.5,
  transitFrames: 12,
} as const;
export function contourDraftMultiplier(frames: number | undefined) {
  return (frames ?? 0) > 0 ? CONTOUR_BRIDGE.draftMultiplier : 1;
}
