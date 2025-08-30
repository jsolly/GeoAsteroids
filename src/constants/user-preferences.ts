export const LOCAL_STORAGE_KEYS = {
  soundOn: 'soundOn',
};

/* Preferences from Localstorage */

export function soundIsOn(): boolean {
  // Check if we're in a browser environment and localStorage is available
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return false; // Default to sound off in SSR or when localStorage is unavailable
  }

  try {
    const soundPref = localStorage.getItem(LOCAL_STORAGE_KEYS.soundOn);
    return soundPref === 'true';
  } catch (error) {
    // Handle cases where localStorage access fails (e.g., private browsing mode)
    console.warn('Failed to access localStorage for sound preference:', error);
    return false; // Default to sound off if access fails
  }
}

// Initialize checkbox state from stored preference (only in browser environment)
if (typeof document !== 'undefined') {
  const defaultSoundPref = document.getElementById('soundPref') as HTMLInputElement;
  if (defaultSoundPref) {
    defaultSoundPref.checked = soundIsOn();
  }
}
