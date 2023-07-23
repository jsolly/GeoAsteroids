import { FPS, LOCAL_STORAGE_KEYS, soundIsOn } from './constants.js';
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
  constructor(src: string, maxStreams: number, vol = 0.05) {
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
  isPlaying(): boolean {
    return !this.streams[this.streamNum].paused;
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
  setMusicTempo(currLevel: number): void {
    const minTempo = 0.25; // Set a lower minimum tempo
    const maxTempo = 4.0; // Set a higher maximum tempo
    const levelsToMinTempo = 15; // Decrease the number of levels to reach minTempo

    // Calculate the ratio based on the user level
    const ratio = Math.min(currLevel / levelsToMinTempo, 1);

    // Set the tempo by interpolating between the maximum and minimum tempo based on the ratio
    this.tempo = maxTempo - (maxTempo - minTempo) * ratio;
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

function setMusic(pref: boolean): void {
  localStorage.setItem(LOCAL_STORAGE_KEYS.musicOn, String(pref));
}

function setSound(pref: boolean): void {
  localStorage.setItem(LOCAL_STORAGE_KEYS.soundOn, String(pref));
}

export { Sound, Music, setMusic, setSound };
