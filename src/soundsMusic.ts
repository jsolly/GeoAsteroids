import {keyUp, keyDown} from './keybindings.js';
import {FPS, SAVE_KEY_MUSIC_ON, SAVE_KEY_SOUND_ON} from './constants.js';
import {getRoidsInfo} from './asteroids.js';
document.addEventListener('keydown', keyDown);
document.addEventListener('keyup', keyUp);
const toggleMusicButton = document.getElementById('toggle-music');
const toggleSoundButton = document.getElementById('toggle-sound');
toggleSoundButton.addEventListener('click', toggleSound);
toggleMusicButton.addEventListener('click', toggleMusic);


/**
 * Plays and stops sounds
 * @param {string} src - Path to sound file
 * @param {number} maxStreams - Number of simultaneous instances of a sound.
 * @param {float} vol - Volume of sound. 0 (silent) - 1 (very loud)
 */


/**
 *
//  */
class Sound {
  src: string;
  maxStreams: number;
  vol: number;
  streamNum = 0;
  streams: HTMLAudioElement[] = [];


  /**
   *
   * @param {string} src - Set the file source of the sound
   * @param {number} maxStreams - Set how many simultaneous sounds can occur
   * @param {number} vol - Set the loudness of the sound
   */
  constructor(src:string, maxStreams=1, vol=0.05) {
    this.src = src;
    this.maxStreams = maxStreams;
    this.vol = vol;
    for (let i = 0; i < maxStreams; i++) {
      this.streams.push(new Audio(src));
      this.streams[i].volume = vol;
    }
  }

  /**
   *
   */
  play(): void {
    if (soundOn) {
      this.streamNum = (this.streamNum + 1) % maxStreams;
      this.streams[this.streamNum].play();
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
   * @param {string} srcLow - The audio file path for the downbeat sound
   * @param {string} srcHigh - The audio file path for the upbeat sound
   */
  constructor(srcLow:string, srcHigh:string) {
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
      this.soundLow.play();
    } else {
      this.soundHigh.play();
    }
    this.low = !this.low;
  }

  /**
   *
   */
  setAsteroidRatio(): void {
    const roidsInfo = getRoidsInfo();
    const ratio =
      roidsInfo.roidsLeft == 0 ? 1 : roidsInfo.roidsLeft / roidsInfo.roidsTotal;

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
let soundOn = getSoundPreference();
let musicOn = getMusicPreference();

/**
 *
 * @return {Boolean} If sound should be playing or not.
 */
function getSoundPreference() {
  const soundPref = localStorage.getItem(SAVE_KEY_SOUND_ON);
  if (soundPref == null) {
    localStorage.setItem(SAVE_KEY_SOUND_ON, 'false'); // False if not found
    return false;
  }
  return soundPref === 'true';
}

/**
 *
 * @return {Boolean} If music should be playing or not
 */
function getMusicPreference() {
  const musicPref = localStorage.getItem(SAVE_KEY_MUSIC_ON);
  if (musicPref == null) {
    localStorage.setItem(SAVE_KEY_MUSIC_ON, 'false'); // False if not found
    return false;
  }
  return musicPref === 'true';
}

/**
 * Flip sound to opposite of existing state
 */
function toggleSound() {
  soundOn = !soundOn;
  localStorage.setItem(SAVE_KEY_SOUND_ON, String(soundOn));
  document.getElementById('toggle-sound').blur();
}

/**
 * Flip music to opposite of existing state
 */
function toggleMusic() {
  musicOn = !musicOn;
  localStorage.setItem(SAVE_KEY_MUSIC_ON, String(musicOn));
  document.getElementById('toggle-music').blur();
}

/**
 *
 * @return {Boolean} True if music is on. False if not.
 */
function getMusicOn() {
  return musicOn;
}

export {Sound, Music, getMusicOn, fxThrust, fxExplode, fxHit, fxLaser, music};
