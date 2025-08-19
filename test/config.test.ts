import { expect, test } from 'vitest';
import {
  Difficulty,
  getRoidNum,
  LOCAL_STORAGE_KEYS,
  musicIsOn,
  setDifficulty,
  soundIsOn,
} from '../src/constants';

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
test('Set Difficulty to Easy', () => {
  expect(getRoidNum()).toBe(undefined);
  setDifficulty(Difficulty.easy);
  expect(getRoidNum()).toBe(5);
});
test('Set Difficulty to Medium', () => {
  setDifficulty(Difficulty.medium);
  expect(getRoidNum()).toBe(10);
});

test('Set Difficulty to Hard', () => {
  setDifficulty(Difficulty.hard);
  expect(getRoidNum()).toBe(50);
});
