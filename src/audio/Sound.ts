import { LOCAL_STORAGE_KEYS, soundIsOn } from '../constants/user-preferences';
import { logger } from '../utils/Logger';

export class Sound {
  streamNum = 0;
  streams: HTMLAudioElement[] = [];
  playing = false;
  private readonly baseVolume: number;

  constructor(src: string, maxStreams: number, vol = 0.05) {
    // Enforce at least one stream to prevent NaN indexing
    maxStreams = Math.max(1, maxStreams);
    this.baseVolume = vol;

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

  async play(volumeScale = 1): Promise<void> {
    if (soundIsOn()) {
      const scale = Number.isFinite(volumeScale) ? Math.min(1, Math.max(0, volumeScale)) : 1;
      if (scale <= 0) {
        return;
      }

      // Defensive guard against empty streams array
      if (this.streams.length === 0) {
        logger.warn('SOUND', 'Sound.play() called but no audio streams available');
        return;
      }

      this.streamNum = (this.streamNum + 1) % this.streams.length;
      const audio = this.streams[this.streamNum];
      if (audio === undefined) {
        logger.warn('SOUND', 'Sound.play() called but stream index is out of range');
        return;
      }

      audio.volume = Math.min(1, this.baseVolume * scale);

      try {
        await audio.play();
        this.playing = true;
      } catch (error) {
        logger.error(
          'SOUND',
          'Failed to play audio',
          error instanceof Error ? error : new Error(String(error))
        );
        this.playing = false;
      }
    }
  }

  stop(): void {
    // Defensive guard against empty streams array
    if (this.streams.length === 0) {
      logger.warn('SOUND', 'Sound.stop() called but no audio streams available');
      return;
    }

    const audio = this.streams[this.streamNum];
    if (audio === undefined) {
      return;
    }
    audio.pause();
    audio.currentTime = 0;
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
 * volumeScale is 1 for local/full volume; 0 skips playback.
 */
export function playSound(sound: Sound, volumeScale = 1): void {
  sound.play(volumeScale).catch(() => {
    // Sound play failed - silently ignore to avoid console spam
  });
}
