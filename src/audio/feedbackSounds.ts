import type { Position } from '../../shared-types';
import { AUDIO } from '../constants';
import { Sound } from './Sound';
import { playWorldSound } from './spatialAudio';

// Sparse acknowledgements. No loops or periodic alarm; continuous flight stays quiet.
const feedback = {
  contourLockAcquired: new Sound(...AUDIO.CONTOUR_LOCK_ACQUIRED),
  contourLockReleased: new Sound(...AUDIO.CONTOUR_LOCK_RELEASED),
  contourFlickSuccess: new Sound(...AUDIO.CONTOUR_FLICK_SUCCESS),
  contourFlickBlocked: new Sound(...AUDIO.CONTOUR_FLICK_BLOCKED),
  connectionLost: new Sound(...AUDIO.CONNECTION_LOST),
  boostIgnite: new Sound(...AUDIO.BOOST_IGNITE),
  hullDamage: new Sound(...AUDIO.HULL_DAMAGE),
  delivery: new Sound(...AUDIO.DELIVERY),
  interface: new Sound(...AUDIO.INTERFACE),
  satelliteEquip: new Sound(...AUDIO.SATELLITE_EQUIP),
};

export function playFeedback(cue: keyof typeof feedback, position?: Position): void {
  playWorldSound(feedback[cue], position);
}
