import { FPS, LOCAL_STORAGE_KEYS } from '../constants';

export class Music {
  srcLow: string;
  soundLow: HTMLAudioElement;
  srcHigh: string;
  soundHigh: HTMLAudioElement;
  low = true;
  tempo = 1.0; // seconds per beat
  beatTime = 0; // the frames left before next beat

  constructor(srcLow: string, srcHigh: string) {
    this.srcLow = srcLow;
    this.soundLow = new Audio(srcLow);
    this.srcHigh = srcHigh;
    this.soundHigh = new Audio(srcHigh);
  }

  play(): void {
    if (this.low) {
      void this.soundLow.play();
    } else {
      void this.soundHigh.play();
    }
    this.low = !this.low;
  }

  setMusicTempo(currLevel: number): void {
    const minTempo = 0.25; // Set a lower minimum tempo
    const maxTempo = 4.0; // Set a higher maximum tempo
    const levelsToMinTempo = 15; // Decrease the number of levels to reach minTempo

    // Calculate the ratio based on the user level
    const ratio = Math.min(currLevel / levelsToMinTempo, 1);

    // Set the tempo by interpolating between the maximum and minimum tempo based on the ratio
    this.tempo = maxTempo - (maxTempo - minTempo) * ratio;
  }

  tick(): void {
    if (this.beatTime === 0) {
      this.play();
      this.beatTime = Math.ceil(this.tempo * FPS);
    } else {
      this.beatTime--;
    }
  }
}

export function setMusic(pref: boolean): void {
  localStorage.setItem(LOCAL_STORAGE_KEYS.musicOn, String(pref));
}
