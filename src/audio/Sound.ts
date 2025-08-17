import { soundIsOn } from '../constants';

export class Sound {
  streamNum = 0;
  streams: HTMLAudioElement[] = [];

  constructor(src: string, maxStreams: number, vol = 0.05) {
    for (let i = 0; i < maxStreams; i++) {
      this.streams.push(new Audio(src));
      this.streams[i].volume = vol;
    }
  }

  play(): void {
    if (soundIsOn()) {
      this.streamNum = (this.streamNum + 1) % this.streams.length;
      void this.streams[this.streamNum].play();
    }
  }

  stop(): void {
    this.streams[this.streamNum].pause();
    this.streams[this.streamNum].currentTime = 0;
  }

  isPlaying(): boolean {
    return !this.streams[this.streamNum].paused;
  }
}

export function setSound(pref: boolean): void {
  localStorage.setItem('soundOn', String(pref));
}
