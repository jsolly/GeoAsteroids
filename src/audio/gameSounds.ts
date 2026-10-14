import type { Position } from '../../shared-types';
import { AUDIO } from '../constants';
import { Sound } from './Sound';
import { playWorldSound } from './spatialAudio';

const fxLaser = new Sound(...AUDIO.LASER);
const fxHit = new Sound(...AUDIO.HIT);

/**
 * Shared laser SFX for local and remote shots. Viewport-culled and
 * distance-attenuated from the local ship. Omit position for local / full volume.
 */
export function playLaserSound(position?: Position): void {
  playWorldSound(fxLaser, position);
}

/**
 * Shared hit SFX for laser impacts (ships and asteroids).
 */
export function playHitSound(position?: Position): void {
  playWorldSound(fxHit, position);
}
