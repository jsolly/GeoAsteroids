import type { Howl } from 'howler';
import { AUDIO } from '../constants';
import { LOCAL_STORAGE_KEYS, musicIsOn } from '../constants/user-preferences';
import { isPlayViewOn } from '../ui/uiUtils';
import { logger } from '../utils/Logger';
import { setStoredItem } from '../utils/safeStorage';
import {
  activateAudio,
  canPlayAudio,
  disposeAudioSound,
  muteMusicKeepSession,
  registerMusicBedAvailability,
  registerMusicSound,
} from './audioRuntime';
import {
  getMusicBedCatalog,
  MUSIC_BED_IDS,
  type MusicBedCatalog,
  type MusicBedId,
  musicBedsAreConfigured,
  setMusicBedCatalogForTests as setCatalog,
} from './musicCatalog';
import { isMusicThreatActive, registerMusicThreatListener, resetMusicThreats } from './musicThreat';
import { isRouteMusicActive, registerRouteMusicListener, resetRouteMusic } from './routeMusic';

type AudioLibrary = typeof import('howler');

const volumes: Record<MusicBedId, number> = {
  menu: AUDIO.MENU_BED_VOLUME,
  inGame: AUDIO.IN_GAME_BED_VOLUME,
  danger: AUDIO.DANGER_BED_VOLUME,
  route: AUDIO.IN_GAME_BED_VOLUME * 1.2,
};

const howls: Partial<Record<MusicBedId, Howl>> = {};
const fadingOut = new Set<string>();
let current: MusicBedId | null = null;
let currentId: number | undefined;
let dangerFailed = false;
let routeFailed = false;
let intenseInGame = false;

function fadeKey(kind: MusicBedId, id: number): string {
  return `${kind}:${id}`;
}

function inPlay(): boolean {
  return isPlayViewOn();
}

function dangerCatalogued(): boolean {
  return !dangerFailed && getMusicBedCatalog().danger.length > 0;
}

function dangerBedUsable(): boolean {
  const howl = howls.danger;
  return dangerCatalogued() && howl !== undefined && canPlayAudio(howl);
}

function shouldIntensifyInGame(): boolean {
  return inPlay() && isMusicThreatActive() && !dangerCatalogued();
}

function desiredBed(): MusicBedId | null {
  if (!musicIsOn() || document.hidden || !musicBedsAreConfigured()) {
    return null;
  }
  const catalog = getMusicBedCatalog();
  if (inPlay()) {
    if (isMusicThreatActive() && dangerBedUsable()) {
      return 'danger';
    }
    if (isRouteMusicActive() && !isMusicThreatActive() && !routeFailed && catalog.route?.length) {
      return 'route';
    }
    return catalog.inGame.length > 0 ? 'inGame' : null;
  }
  return catalog.menu.length > 0 ? 'menu' : null;
}

function stopImmediate(): void {
  fadingOut.clear();
  intenseInGame = false;
  for (const howl of Object.values(howls)) {
    howl?.rate(1);
    howl?.stop();
  }
  current = null;
  currentId = undefined;
}

function fadeOut(kind: MusicBedId, id: number): void {
  const howl = howls[kind];
  if (!howl) {
    return;
  }
  // Howler fade(id) does not cancel a live fade; volume() does, and _stopFade
  // emits `fade`. Clear that cancel before marking fade-out or onfade stops
  // the outgoing bed immediately.
  const currentVolume = howl.volume(id);
  const from = typeof currentVolume === 'number' ? currentVolume : volumes[kind];
  howl.volume(from, id);
  fadingOut.add(fadeKey(kind, id));
  howl.fade(from, 0, AUDIO.BED_CROSSFADE_MS, id);
}

function inGameVolume(intense: boolean) {
  return intense ? AUDIO.DANGER_FALLBACK_VOLUME : volumes.inGame;
}

function inGameRate(intense: boolean) {
  return intense ? AUDIO.DANGER_FALLBACK_RATE : 1;
}

function applyInGameTreatment(howl: Howl, id: number, intense: boolean): void {
  const volume = inGameVolume(intense);
  const rate = inGameRate(intense);
  if (intenseInGame === intense) {
    howl.rate(rate, id);
    return;
  }
  intenseInGame = intense;
  howl.rate(rate, id);
  const currentVolume = howl.volume(id);
  const from = typeof currentVolume === 'number' ? currentVolume : volumes.inGame;
  howl.volume(from, id);
  howl.fade(from, volume, AUDIO.BED_CROSSFADE_MS, id);
}

function playBed(kind: MusicBedId): void {
  const howl = howls[kind];
  if (!howl || !canPlayAudio(howl)) {
    return;
  }
  const intense = kind === 'inGame' && shouldIntensifyInGame();
  if (current === kind && currentId !== undefined && howl.playing(currentId)) {
    if (kind === 'inGame') {
      applyInGameTreatment(howl, currentId, intense);
    }
    return;
  }
  const previous = current;
  const previousId = currentId;
  const synchronized =
    (kind === 'route' && previous === 'inGame') || (kind === 'inGame' && previous === 'route');
  const position = synchronized && previous !== null ? howls[previous]?.seek() : undefined;
  const id = howl.play();
  if (typeof position === 'number' && Number.isFinite(position)) {
    howl.seek(position, id);
  }
  current = kind;
  currentId = id;
  if (kind === 'inGame') {
    intenseInGame = intense;
    howl.rate(inGameRate(intense), id);
    howl.volume(0, id);
    howl.fade(0, inGameVolume(intense), AUDIO.BED_CROSSFADE_MS, id);
  } else {
    intenseInGame = false;
    howl.rate(1, id);
    howl.volume(0, id);
    howl.fade(0, volumes[kind], AUDIO.BED_CROSSFADE_MS, id);
  }
  if (previous !== null && previous !== kind && previousId !== undefined) {
    fadeOut(previous, previousId);
  }
}

function syncMusicBeds(): void {
  const want = desiredBed();
  if (want === null) {
    if (current !== null && currentId !== undefined) {
      fadeOut(current, currentId);
      current = null;
      currentId = undefined;
      intenseInGame = false;
    }
    return;
  }
  // activateAudio runs the music initializer, which plays the desired bed
  // once Howler and the shared context are live.
  activateAudio();
}

function handleBedLoadError(kind: MusicBedId): void {
  howls[kind]?.unload();
  if (kind === 'route') {
    routeFailed = true;
    syncMusicBeds();
    return;
  }
  if (kind !== 'danger') {
    return;
  }
  dangerFailed = true;
  syncMusicBeds();
}

function ensureHowls(audio: AudioLibrary): void {
  const catalog = getMusicBedCatalog();
  for (const kind of MUSIC_BED_IDS) {
    if (kind === 'route' && (!inPlay() || !isRouteMusicActive())) {
      continue;
    }
    const src = catalog[kind] ?? [];
    if (src.length === 0 || howls[kind]) {
      continue;
    }
    const howl = new audio.Howl({
      src: [...src],
      html5: false,
      preload: true,
      autoplay: false,
      loop: true,
      pool: 1,
      volume: 0,
      onload: () => {
        if (howls[kind] === howl) {
          syncMusicBeds();
        }
      },
      onloaderror: (_id, error) => {
        if (howls[kind] !== howl) {
          return;
        }
        logger.warn('SOUND', 'Music bed failed to load', { bed: kind, error });
        handleBedLoadError(kind);
      },
      onplayerror: (id, error) => {
        if (howls[kind] !== howl) {
          return;
        }
        logger.warn('SOUND', 'Music bed failed to play', { bed: kind, error });
        howls[kind]?.stop(id);
      },
      onfade: (id) => {
        const bed = howls[kind];
        if (bed !== howl) {
          return;
        }
        const faded = bed?.volume(id);
        if (!fadingOut.has(fadeKey(kind, id))) {
          return;
        }
        if (typeof faded === 'number' && faded > 0.0001) {
          return;
        }
        fadingOut.delete(fadeKey(kind, id));
        bed?.rate(1, id);
        bed?.stop(id);
      },
    });
    howls[kind] = howl;
  }
}

function startMusic(audio: AudioLibrary): void {
  ensureHowls(audio);
  const want = desiredBed();
  if (want !== null) {
    playBed(want);
  }
}

function onGesture(): void {
  if (musicIsOn() && musicBedsAreConfigured()) {
    activateAudio();
    syncMusicBeds();
  }
}

function onPlayViewOff(): void {
  resetRouteMusic();
  resetMusicThreats();
  syncMusicBeds();
}

export function setMusic(pref: boolean): void {
  setStoredItem(LOCAL_STORAGE_KEYS.musicOn, String(pref));
  if (pref) {
    activateAudio();
    syncMusicBeds();
    return;
  }
  muteMusicKeepSession();
}

export function setMusicBedCatalogForTests(next: MusicBedCatalog): void {
  stopImmediate();
  unloadBeds();
  setCatalog(next);
  registerMusicBedAvailability(musicBedsAreConfigured());
  resetMusicThreats();
}

function unloadBeds(): void {
  for (const kind of MUSIC_BED_IDS) {
    const howl = howls[kind];
    if (howl) {
      disposeAudioSound(howl);
    }
    delete howls[kind];
  }
  dangerFailed = false;
  routeFailed = false;
}

registerMusicBedAvailability(musicBedsAreConfigured());
registerMusicSound(startMusic, stopImmediate, unloadBeds);
registerMusicThreatListener(syncMusicBeds);
registerRouteMusicListener(syncMusicBeds);
let listenerScope: AbortController | null = null;

export function mountMusicBeds(): void {
  if (listenerScope) {
    return;
  }
  listenerScope = new AbortController();
  const { signal } = listenerScope;
  window.addEventListener('playViewOn', syncMusicBeds, { signal });
  window.addEventListener('playViewOff', onPlayViewOff, { signal });
  document.addEventListener('pointerdown', onGesture, { capture: true, signal });
  document.addEventListener('touchend', onGesture, { capture: true, signal });
  document.addEventListener('keydown', onGesture, { capture: true, signal });
  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden) {
        resetRouteMusic();
      }
    },
    { signal }
  );
}

export function disposeMusicBeds(): void {
  resetRouteMusic();
  listenerScope?.abort();
  listenerScope = null;
  stopImmediate();
  unloadBeds();
  resetMusicThreats();
}

export function readMusicDiagnostics() {
  return {
    desiredBed: desiredBed(),
    currentBed: current,
    beds: MUSIC_BED_IDS.map((bed) => ({
      bed,
      state: howls[bed]?.state() ?? 'not-created',
      playing: howls[bed]?.playing() ?? false,
    })),
  };
}
