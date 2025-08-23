export const LOCAL_STORAGE_KEYS = {
  soundOn: 'soundOn',
};

/* Preferences from Localstorage */

export function soundIsOn(): boolean {
  const soundPref = localStorage.getItem(LOCAL_STORAGE_KEYS.soundOn);
  return soundPref === 'true';
}

const defaultSoundPref = document.getElementById('soundPref') as HTMLInputElement;

if (soundIsOn()) {
  defaultSoundPref.checked = true;
}
