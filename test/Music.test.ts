import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { Music, setMusic } from '../src/audio/Music';
import { LOCAL_STORAGE_KEYS, musicIsOn } from '../src/constants';

let testMusic: Music;
const mockPlay = vi.fn();

beforeEach(() => {
  localStorage.setItem(LOCAL_STORAGE_KEYS.musicOn, 'true');

  testMusic = new Music('../public/sounds/music-low.m4a', '../public/sounds/music-high.m4a');
  testMusic.soundLow.play = mockPlay;
  testMusic.soundHigh.play = mockPlay;
  testMusic.soundLow.pause = mockPlay;
  testMusic.soundHigh.pause = mockPlay;
});

afterEach(() => {
  // Restore the original functions after each test
  vi.restoreAllMocks();

  localStorage.removeItem(LOCAL_STORAGE_KEYS.musicOn);
});

test.concurrent('Music', () => {
  expect(testMusic).toBeInstanceOf(Music);
  expect(testMusic.soundLow).toBeInstanceOf(Audio);
  expect(testMusic.soundHigh).toBeInstanceOf(Audio);
});

test.concurrent('Set Music', () => {
  const currMusicOn = musicIsOn();
  setMusic(!currMusicOn);
  expect(musicIsOn()).toBe(!currMusicOn);
});

test.concurrent('Set Music - local storage', () => {
  setMusic(true);
  expect(localStorage.getItem(LOCAL_STORAGE_KEYS.musicOn)).toBe('true');
  setMusic(false);
  expect(localStorage.getItem(LOCAL_STORAGE_KEYS.musicOn)).toBe('false');
});

test.concurrent('Music tempo control', () => {
  testMusic.setMusicTempo(1);
  expect(testMusic.tempo).toBe(3.75); // calculated tempo for level 1

  testMusic.setMusicTempo(15);
  expect(testMusic.tempo).toBe(0.25); // min tempo for high level

  testMusic.setMusicTempo(7);
  expect(testMusic.tempo).toBeGreaterThan(0.25);
  expect(testMusic.tempo).toBeLessThan(4.0);
});

test.concurrent('Music tick and play', () => {
  testMusic.tempo = 0.1; // Set a very fast tempo for testing
  testMusic.beatTime = 0;

  testMusic.tick();
  expect(mockPlay).toHaveBeenCalled();
  expect(testMusic.beatTime).toBeGreaterThan(0);
});
