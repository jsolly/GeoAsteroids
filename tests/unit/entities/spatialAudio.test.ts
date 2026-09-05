import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { getExplosionSound, playExplosionSound } from '../../../src/audio/explosionSound';
import { Sound } from '../../../src/audio/Sound';
import {
  bindGameAudio,
  isInViewport,
  planPositionalPlayback,
  resetGameAudio,
  volumeScaleForDistance,
} from '../../../src/audio/spatialAudio';
import { AUDIO } from '../../../src/constants';
import { LOCAL_STORAGE_KEYS } from '../../../src/constants/user-preferences';

const listener = { x: 400, y: 300 };
const viewport = { width: 800, height: 600 };

beforeEach(() => {
  localStorage.setItem(LOCAL_STORAGE_KEYS.soundOn, 'true');
  resetGameAudio();
});

afterEach(() => {
  resetGameAudio();
  vi.restoreAllMocks();
  localStorage.removeItem(LOCAL_STORAGE_KEYS.soundOn);
});

test('sound with no position plays at full volume', () => {
  expect(planPositionalPlayback(undefined, listener, viewport, { requireViewport: true })).toEqual({
    shouldPlay: true,
    volumeScale: 1,
  });
});

test('sound with no listener plays at full volume', () => {
  expect(
    planPositionalPlayback({ x: 0, y: 0 }, undefined, viewport, { requireViewport: true })
  ).toEqual({
    shouldPlay: true,
    volumeScale: 1,
  });
});

test('explosion at the local ship is in the viewport at full volume', () => {
  expect(isInViewport(listener, listener, viewport)).toBe(true);
  expect(
    planPositionalPlayback(listener, listener, viewport, { requireViewport: true })
  ).toEqual({
    shouldPlay: true,
    volumeScale: 1,
  });
});

test('explosion inside the viewport far from the ship is quieter than a near explosion', () => {
  const farOnScreen = { x: listener.x + 300, y: listener.y };
  const plan = planPositionalPlayback(farOnScreen, listener, viewport, { requireViewport: true });
  expect(isInViewport(farOnScreen, listener, viewport)).toBe(true);
  expect(plan.shouldPlay).toBe(true);
  expect(plan.volumeScale).toBeGreaterThan(0);
  expect(plan.volumeScale).toBeLessThan(1);
  expect(plan.volumeScale).toBe(volumeScaleForDistance(300, Math.hypot(400, 300)));
});

test('explosion outside the viewport does not play', () => {
  const offScreen = { x: listener.x + 1000, y: listener.y };
  expect(isInViewport(offScreen, listener, viewport)).toBe(false);
  expect(
    planPositionalPlayback(offScreen, listener, viewport, { requireViewport: true })
  ).toEqual({
    shouldPlay: false,
    volumeScale: 0,
  });
});

test('close world sounds are louder than far world sounds without viewport culling', () => {
  const near = planPositionalPlayback({ x: listener.x + 50, y: listener.y }, listener, viewport);
  const far = planPositionalPlayback({ x: listener.x + 400, y: listener.y }, listener, viewport);
  expect(near.shouldPlay).toBe(true);
  expect(far.shouldPlay).toBe(true);
  expect(near.volumeScale).toBeGreaterThan(far.volumeScale);
});

test('playExplosionSound skips off-viewport explosions and plays near ones', () => {
  bindGameAudio({
    getListenerPosition: () => listener,
    getViewport: () => viewport,
  });

  const playSpy = vi.spyOn(Sound.prototype, 'play').mockResolvedValue(undefined);

  playExplosionSound({ x: listener.x + 1000, y: listener.y });
  expect(playSpy).not.toHaveBeenCalled();

  playExplosionSound(listener);
  expect(playSpy).toHaveBeenCalledTimes(1);
  expect(playSpy).toHaveBeenCalledWith(1);
});

test('one explosion event uses the shared explosion sound instance', () => {
  expect(getExplosionSound()).toBe(getExplosionSound());
  expect(getExplosionSound()).toBeInstanceOf(Sound);
});

test('a second explode on the same ship does not play another sound', async () => {
  bindGameAudio({
    getListenerPosition: () => listener,
    getViewport: () => viewport,
  });

  const playSpy = vi.spyOn(Sound.prototype, 'play').mockResolvedValue(undefined);
  const { Ship } = await import('../../../src/entities/ship/Ship');
  const ship = new Ship({ position: listener });
  ship.explode();
  ship.explode();
  expect(playSpy).toHaveBeenCalledTimes(1);
});

test('in-viewport explosions never drop below the audible floor', () => {
  const corner = { x: listener.x + 399, y: listener.y + 299 };
  const plan = planPositionalPlayback(corner, listener, viewport, { requireViewport: true });
  expect(plan.shouldPlay).toBe(true);
  expect(plan.volumeScale).toBeGreaterThanOrEqual(AUDIO.MIN_IN_VIEWPORT_VOLUME);
});
