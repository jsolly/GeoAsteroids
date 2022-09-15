import { FPS, LOCAL_STORAGE_KEYS, getRoidNum, soundIsOn } from './config.js';
import { Roid } from './asteroids.js';
import { currLevel } from './main.js';
/**
 * Plays and stops sounds
 * @param src - Path to sound file
 * @param maxStreams - Number of simultaneous instances of a sound.
 * @param vol - Volume of sound. 0 (silent) - 1 (very loud)
 */

/**
 *
//  */
class Sound {
  streamNum = 0;
  streams: HTMLAudioElement[] = [];

  /**
   *
   * @param src - Set the file source of the sound
   * @param maxStreams - Set how many simultaneous sounds can occur
   * @param vol - Set the loudness of the sound
   */
  constructor(src: string, maxStreams = 1, vol = 0.05) {
    for (let i = 0; i < maxStreams; i++) {
      this.streams.push(new Audio(src));
      this.streams[i].volume = vol;
    }
  }

  /**
   *
   */
  play(): void {
    if (soundIsOn()) {
      this.streamNum = (this.streamNum + 1) % this.streams.length;
      void this.streams[this.streamNum].play();
    }
  }
  /**
   *
   */
  stop(): void {
    this.streams[this.streamNum].pause();
    this.streams[this.streamNum].currentTime = 0;
  }
}

/**
 *
 */
class Music {
  srcLow: string;
  soundLow: HTMLAudioElement;
  srcHigh: string;
  soundHigh: HTMLAudioElement;
  low = true;
  tempo = 1.0; // seconds per beat
  beatTime = 0; // the frames left before next beat

  /**
   *
   * @param srcLow - The audio file path for the downbeat sound
   * @param srcHigh - The audio file path for the upbeat sound
   */
  constructor(srcLow: string, srcHigh: string) {
    this.srcLow = srcLow;
    this.soundLow = new Audio(srcLow);
    this.srcHigh = srcHigh;
    this.soundHigh = new Audio(srcHigh);
  }

  /**
   *
   */
  play(): void {
    if (this.low) {
      void this.soundLow.play();
    } else {
      void this.soundHigh.play();
    }
    this.low = !this.low;
  }

  /**
   *
   */
  setRoidRatio(roids: Roid[]): void {
    const roidNum = getRoidNum();
    const roidsTotal = (roidNum + currLevel) * 7;
    const ratio = roids.length == 0 ? 1 : roids.length / roidsTotal;

    this.tempo = 1.0 - 0.75 * (1.0 - ratio);
  }

  /**
   *
   */
  tick(): void {
    if (this.beatTime == 0) {
      this.play();
      this.beatTime = Math.ceil(this.tempo * FPS);
    } else {
      this.beatTime--;
    }
  }
}

const fxThrust = new Sound('sounds/thrust.m4a');
const maxStreams = 5;
const fxLaser = new Sound('sounds/laser.m4a', maxStreams);
const fxHit = new Sound('sounds/hit.m4a', maxStreams);
const fxExplode = new Sound('sounds/explode.m4a');
const music = new Music('sounds/music-low.m4a', 'sounds/music-high.m4a');

function setMusic(pref: boolean): void {
  localStorage.setItem(LOCAL_STORAGE_KEYS.musicOn, String(pref));
}

function setSound(pref: boolean): void {
  localStorage.setItem(LOCAL_STORAGE_KEYS.soundOn, String(pref));
}

export {
  Sound,
  Music,
  setMusic,
  setSound,
  music,
  fxThrust,
  fxExplode,
  fxHit,
  fxLaser,
};
