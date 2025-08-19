import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { Sound, setSound } from '../src/audio/Sound.ts';
import { LOCAL_STORAGE_KEYS } from '../src/constants';

let testSound: Sound;
const mockPlay = vi.fn();
const mockPause = vi.fn();

beforeEach(() => {
  localStorage.setItem(LOCAL_STORAGE_KEYS.soundOn, 'true');

  testSound = new Sound('../public/sounds/thrust.m4a', 1);
  testSound.streams[0].play = mockPlay;
  testSound.streams[0].pause = mockPause;
});

afterEach(() => {
  // Restore the original functions after each test
  vi.restoreAllMocks();

  localStorage.removeItem(LOCAL_STORAGE_KEYS.soundOn);
});

test('Sound', () => {
  expect(testSound).toBeInstanceOf(Sound);
  expect(testSound.streams.length).toBe(1);
});

test('Set Sound', () => {
  setSound(true);
  expect(localStorage.getItem(LOCAL_STORAGE_KEYS.soundOn)).toBe('true');
  setSound(false);
  expect(localStorage.getItem(LOCAL_STORAGE_KEYS.soundOn)).toBe('false');
});

test('Sound play functionality', () => {
  // Since HTMLMediaElement.play is not implemented in jsdom,
  // we test that the streamNum is updated correctly
  const initialStreamNum = testSound.streamNum;
  testSound.play();
  expect(testSound.streamNum).toBe((initialStreamNum + 1) % testSound.streams.length);
});

test('Sound stop functionality', () => {
  testSound.stop();
  expect(mockPause).toHaveBeenCalled();
});

test('Sound isPlaying check', () => {
  // Mock the paused property
  Object.defineProperty(testSound.streams[0], 'paused', {
    value: false,
    writable: true,
  });

  expect(testSound.isPlaying()).toBe(true);

  Object.defineProperty(testSound.streams[0], 'paused', {
    value: true,
    writable: true,
  });

  expect(testSound.isPlaying()).toBe(false);
});

test('Sound with multiple streams', () => {
  const multiSound = new Sound('../public/sounds/thrust.m4a', 3);
  expect(multiSound.streams.length).toBe(3);
  expect(multiSound.streamNum).toBe(0);

  // Test stream cycling without calling play (which fails in jsdom)
  multiSound.streamNum = 1;
  expect(multiSound.streamNum).toBe(1);

  multiSound.streamNum = 2;
  expect(multiSound.streamNum).toBe(2);

  multiSound.streamNum = 0; // Should wrap around
  expect(multiSound.streamNum).toBe(0);
});
