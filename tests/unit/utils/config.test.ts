import { beforeEach, expect, test } from 'vitest';

import { musicIsOn, soundIsOn } from '../../../src/constants/user-preferences';

beforeEach(() => {
  localStorage.clear();
});

test('Sound On', () => {
  localStorage.setItem('soundOn', 'true');
  expect(soundIsOn()).toBe(true);
});

test('Sound Off', () => {
  localStorage.setItem('soundOn', 'false');
  expect(soundIsOn()).toBe(false);
});

test('Music defaults on until a pilot turns it off', () => {
  expect(musicIsOn()).toBe(true);
  localStorage.setItem('musicOn', 'false');
  expect(musicIsOn()).toBe(false);
  localStorage.setItem('musicOn', 'true');
  expect(musicIsOn()).toBe(true);
});
