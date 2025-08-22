import { beforeEach, expect, test } from 'vitest';
import { LOCAL_STORAGE_KEYS, musicIsOn, ROID_NUM, soundIsOn } from '../src/constants';

beforeEach(() => {
  localStorage.clear();
});

test('Local Storage Keys', () => {
  expect(LOCAL_STORAGE_KEYS.soundOn).toBe('soundOn');
  expect(LOCAL_STORAGE_KEYS.musicOn).toBe('musicOn');
});

test('Sound On', () => {
  localStorage.setItem('soundOn', 'true');
  expect(soundIsOn()).toBe(true);
});

test('Sound Off', () => {
  localStorage.setItem('soundOn', 'false');
  expect(soundIsOn()).toBe(false);
});

test('Music On', () => {
  localStorage.setItem('musicOn', 'true');
  expect(musicIsOn()).toBe(true);
});

test('Music Off', () => {
  localStorage.setItem('musicOn', 'false');
  expect(musicIsOn()).toBe(false);
});
test('ROID_NUM constant', () => {
  expect(ROID_NUM).toBe(10);
});
