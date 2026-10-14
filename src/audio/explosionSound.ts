import type { Position } from '../../shared-types';
import { AUDIO } from '../constants';
import { Sound } from './Sound';
import { playWorldSound } from './spatialAudio';

const fxExplode = new Sound(...AUDIO.EXPLOSION);

/**
 * Single explosion SFX path. Positioned explosions are viewport-culled and
 * distance-attenuated from the local ship. Omit position for local / full volume.
 */
export function playExplosionSound(position?: Position): void {
  playWorldSound(fxExplode, position);
}
