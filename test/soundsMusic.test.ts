import { expect, test, vi, beforeEach, afterEach } from 'vitest';
import { Sound, Music, setMusic, setSound } from '../src/soundsMusic';
import { soundIsOn, musicIsOn, LOCAL_STORAGE_KEYS } from '../src/constants';

let testMusic: Music;
let testSound: Sound;
const mockPlay = vi.fn();

beforeEach(() => {
  localStorage.setItem(LOCAL_STORAGE_KEYS.musicOn, 'true');
  localStorage.setItem(LOCAL_STORAGE_KEYS.soundOn, 'true');

  testMusic = new Music(
    '../public/sounds/music-low.m4a',
    '../public/sounds/music-high.m4a',
  );
  testMusic.soundLow.play = mockPlay;
  testMusic.soundHigh.play = mockPlay;
  testMusic.soundLow.pause = mockPlay;
  testMusic.soundHigh.pause = mockPlay;

  testSound = new Sound('../public/sounds/thrust.m4a', 1);
  testSound.streams[0].play = mockPlay;
  testSound.streams[0].pause = mockPlay;
});

afterEach(() => {
  // Restore the original functions after each test
  vi.restoreAllMocks();

  localStorage.removeItem(LOCAL_STORAGE_KEYS.musicOn);
  localStorage.removeItem(LOCAL_STORAGE_KEYS.soundOn);
});

test.concurrent('Sound', () => {
  expect(testSound).toBeInstanceOf(Sound);
  expect(testSound.streams.length).toBe(1);
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

test.concurrent('Set Sound', () => {
  const currSoundOn = soundIsOn();
  setSound(!currSoundOn);
  expect(soundIsOn()).toBe(!currSoundOn);
});

test.concurrent('Set Music and Sound - local storage', () => {
  setMusic(true);
  expect(localStorage.getItem(LOCAL_STORAGE_KEYS.musicOn)).toBe('true');
  setMusic(false);
  expect(localStorage.getItem(LOCAL_STORAGE_KEYS.musicOn)).toBe('false');

  setSound(true);
  expect(localStorage.getItem(LOCAL_STORAGE_KEYS.soundOn)).toBe('true');
  setSound(false);
  expect(localStorage.getItem(LOCAL_STORAGE_KEYS.soundOn)).toBe('false');
});
