import type { Position } from '../../shared-types';
import { AUDIO } from '../constants';
import { soundIsOn } from '../constants/user-preferences';
import { getDistance } from '../utils/mathUtils';
import { playSound, type Sound } from './Sound';

type ViewportSize = { width: number; height: number };

interface PlaybackPlan {
  shouldPlay: boolean;
  volumeScale: number;
  offset?: Position;
}

type ListenerProvider = () => Position | undefined;
type ViewportProvider = () => ViewportSize | undefined;

let getListenerPosition: ListenerProvider = () => undefined;
let getViewportSize: ViewportProvider = () => undefined;
let worldAudioSuppressed = false;

/** Applying a connection baseline updates retained entities without replaying missed events. */
export function withoutWorldAudio(apply: () => void): void {
  const previous = worldAudioSuppressed;
  worldAudioSuppressed = true;
  try {
    apply();
  } finally {
    worldAudioSuppressed = previous;
  }
}

export function bindGameAudio(options: {
  getListenerPosition: ListenerProvider;
  getViewport: ViewportProvider;
}): void {
  getListenerPosition = options.getListenerPosition;
  getViewportSize = options.getViewport;
}

export function resetGameAudio(): void {
  getListenerPosition = () => undefined;
  getViewportSize = () => undefined;
}

/**
 * Screen-space test matching canvasManager.worldToScreen (local ship at center).
 */
export function isInViewport(
  worldPos: Position,
  listener: Position,
  viewport: ViewportSize
): boolean {
  const offset = { x: worldPos.x - listener.x, y: worldPos.y - listener.y };
  const screenX = viewport.width / 2 + offset.x;
  const screenY = viewport.height / 2 + offset.y;
  return screenX >= 0 && screenX <= viewport.width && screenY >= 0 && screenY <= viewport.height;
}

export function volumeScaleForDistance(distance: number, maxDistance: number): number {
  if (!(maxDistance > 0) || !(distance > 0)) {
    return 1;
  }
  if (distance >= maxDistance) {
    return 0;
  }
  // Smoothstep: stay warmer nearby, blush away toward the edge (not a hard linear drop).
  const t = 1 - distance / maxDistance;
  return t * t * (3 - 2 * t);
}

function maxAudibleDistance(viewport?: ViewportSize): number {
  if (!viewport) {
    return AUDIO.FALLBACK_MAX_DISTANCE;
  }
  return Math.hypot(viewport.width / 2, viewport.height / 2);
}

/**
 * Decide whether to play and at what volume.
 * No position (or no listener) => local / full volume.
 * Sources outside the viewport are silent.
 */
export function planPositionalPlayback(
  sourcePosition: Position | undefined,
  listener: Position | undefined,
  viewport: ViewportSize | undefined
): PlaybackPlan {
  if (sourcePosition === undefined || listener === undefined) {
    return { shouldPlay: true, volumeScale: 1 };
  }

  const inViewport = viewport ? isInViewport(sourcePosition, listener, viewport) : true;

  if (viewport && !inViewport) {
    return { shouldPlay: false, volumeScale: 0 };
  }

  let volumeScale = volumeScaleForDistance(
    getDistance(sourcePosition, listener),
    maxAudibleDistance(viewport)
  );

  if (inViewport) {
    volumeScale = Math.max(volumeScale, AUDIO.MIN_IN_VIEWPORT_VOLUME);
  }

  return {
    shouldPlay: volumeScale > 0,
    volumeScale,
    offset: { x: sourcePosition.x - listener.x, y: sourcePosition.y - listener.y },
  };
}

export function planBoundPlayback(sourcePosition: Position | undefined): PlaybackPlan {
  if (worldAudioSuppressed) {
    return { shouldPlay: false, volumeScale: 0 };
  }
  return planPositionalPlayback(sourcePosition, getListenerPosition(), getViewportSize());
}

export function playWorldSound(sound: Sound, position?: Position): void {
  if (!soundIsOn()) {
    return;
  }
  const plan = planBoundPlayback(position);
  if (!plan.shouldPlay) {
    return;
  }
  playSound(sound, plan.volumeScale, plan.offset);
}
