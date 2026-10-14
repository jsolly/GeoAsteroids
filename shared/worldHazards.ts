import type { HazardPhase } from '../shared-types';

const HALF_HOUR = 30 * 60_000;
/** UTC epoch arithmetic survives pauses and restarts without replaying past activity. */
export function hazardPhase(now: number): HazardPhase {
  const time = Math.max(0, Math.floor(now));
  const start = Math.floor(time / HALF_HOUR) * HALF_HOUR;
  const offset = time - start;
  const kind = Math.floor(start / HALF_HOUR) % 2 === 0 ? 'swarm' : 'meteors';
  if (offset < 3 * 60_000) {
    return { phase: 'active', kind, startsAt: start, endsAt: start + 3 * 60_000 };
  }
  const next = start + HALF_HOUR;
  return {
    phase: offset >= 25 * 60_000 ? 'warning' : 'quiet',
    kind: kind === 'swarm' ? 'meteors' : 'swarm',
    startsAt: next,
    endsAt: next + 3 * 60_000,
  };
}
