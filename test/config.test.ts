import { expect, test } from 'vitest';
import {
  LOCAL_STORAGE_KEYS,
  soundIsOn,
  musicIsOn,
  getRoidNum,
  setDifficulty,
  Difficulty,
} from '../src/constants';

test.concurrent('Local Storage Keys', () => {
  expect(LOCAL_STORAGE_KEYS.soundOn).toBe('soundOn');
  expect(LOCAL_STORAGE_KEYS.musicOn).toBe('musicOn');
});

test.concurrent('Sound On', () => {
  localStorage.setItem('soundOn', 'true');
  expect(soundIsOn()).toBe(true);
});

test.concurrent('Sound Off', () => {
  localStorage.setItem('soundOn', 'false');
  expect(soundIsOn()).toBe(false);
});

test.concurrent('Music On', () => {
  localStorage.setItem('musicOn', 'true');
  expect(musicIsOn()).toBe(true);
});

test.concurrent('Music Off', () => {
  localStorage.setItem('musicOn', 'false');
  expect(musicIsOn()).toBe(false);
});
test.concurrent('Set Difficulty to Easy', () => {
  expect(getRoidNum()).toBe(undefined);
  setDifficulty(Difficulty.easy);
  expect(getRoidNum()).toBe(5);
});
test.concurrent('Set Difficulty to Medium', () => {
  setDifficulty(Difficulty.medium);
  expect(getRoidNum()).toBe(10);
});

test.concurrent('Set Difficulty to Hard', () => {
  setDifficulty(Difficulty.hard);
  expect(getRoidNum()).toBe(50);
});
