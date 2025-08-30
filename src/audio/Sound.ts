import { LOCAL_STORAGE_KEYS, soundIsOn } from '../constants/user-preferences';

export class Sound {
  streamNum = 0;
  streams: HTMLAudioElement[] = [];
  playing = false;

  constructor(src: string, maxStreams: number, vol = 0.05) {
    for (let i = 0; i < maxStreams; i++) {
      const audio = new Audio(src);
      audio.volume = vol;

      // Keep playing flag in sync with actual playback state
      audio.addEventListener('ended', () => {
        this.playing = false;
      });
      audio.addEventListener('pause', () => {
        this.playing = false;
      });

      this.streams.push(audio);
    }
  }

  async play(): Promise<void> {
    if (soundIsOn()) {
      this.streamNum = (this.streamNum + 1) % this.streams.length;
      const audio = this.streams[this.streamNum];

      try {
        await audio.play();
        this.playing = true;
      } catch (error) {
        console.error('Failed to play audio:', error);
        this.playing = false;
      }
    }
  }

  stop(): void {
    this.streams[this.streamNum].pause();
    this.streams[this.streamNum].currentTime = 0;
    this.playing = false;
  }

  isPlaying(): boolean {
    // Check actual media state when stream exists and is accessible
    if (this.streamNum >= 0 && this.streamNum < this.streams.length) {
      const currentStream = this.streams[this.streamNum];
      if (currentStream) {
        return !currentStream.paused;
      }
    }
    // Fall back to internal flag when no valid stream
    return this.playing;
  }
}

export function setSound(pref: boolean): void {
  localStorage.setItem(LOCAL_STORAGE_KEYS.soundOn, String(pref));
}

/**
 * Clean utility for playing sounds with explicit error suppression.
 * Use this instead of void sound.play() for cleaner code.
 */
export function playSound(sound: Sound): void {
  sound.play().catch(() => {
    // Sound play failed - silently ignore to avoid console spam
  });
}
