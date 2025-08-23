import { beforeEach, expect, test } from 'vitest';
import { ROID_NUM } from '../src/constants/game';
import { LOCAL_STORAGE_KEYS, soundIsOn } from '../src/constants/user-preferences';

beforeEach(() => {
  localStorage.clear();
});

test('Local Storage Keys', () => {
  expect(LOCAL_STORAGE_KEYS.soundOn).toBe('soundOn');
});

test('Sound On', () => {
  localStorage.setItem('soundOn', 'true');
  expect(soundIsOn()).toBe(true);
});

test('Sound Off', () => {
  localStorage.setItem('soundOn', 'false');
  expect(soundIsOn()).toBe(false);
});

test('ROID_NUM constant', () => {
  expect(ROID_NUM).toBe(10);
});
