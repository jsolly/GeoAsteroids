export const LOCAL_STORAGE_KEYS = {
  soundOn: 'soundOn',
  musicOn: 'musicOn',
};

/* Preferences from Localstorage */

export function soundIsOn(): boolean {
  const soundPref = localStorage.getItem(LOCAL_STORAGE_KEYS.soundOn);
  return soundPref === 'true';
}

export function musicIsOn(): boolean {
  const musicPref = localStorage.getItem(LOCAL_STORAGE_KEYS.musicOn);
  return musicPref === 'true';
}

const defaultSoundPref = document.getElementById('soundPref') as HTMLInputElement;
const defaultMusicPref = document.getElementById('musicPref') as HTMLInputElement;

if (soundIsOn()) {
  defaultSoundPref.checked = true;
}

if (musicIsOn()) {
  defaultMusicPref.checked = true;
}
