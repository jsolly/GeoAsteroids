import { expect, test } from 'vitest';
import { Sound, Music, setMusic, setSound } from '../src/soundsMusic.js';
import { soundIsOn, musicIsOn } from '../src/config.js';
test.concurrent('Sound', () => {
  const testSound = new Sound('sounds/thrust.m4a', 1);
  expect(testSound).toBeInstanceOf(Sound);
  expect(testSound.streams.length).toBe(1);
});

test.concurrent('Music', () => {
  const testMusic = new Music('sounds/music-low.m4a', 'sounds/music-high.m4a');
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
