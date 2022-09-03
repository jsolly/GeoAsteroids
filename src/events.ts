import { keyDown, keyUp } from './keybindings.js';
import { setSound, setMusic } from './soundsMusic.js';
import { setDifficulty } from './constants.js';

import { startGame } from './main.js';
document.addEventListener('keydown', keyDown);
document.addEventListener('keyup', keyUp);
const startGameBtn = document.getElementById('start-game') as HTMLButtonElement;
const soundCheckBox = document.getElementById('soundPref') as HTMLInputElement;
const musicCheckBox = document.getElementById('musicPref') as HTMLInputElement;
const easyBtn = document.getElementById('easy') as HTMLInputElement;
const medBtn = document.getElementById('medium') as HTMLInputElement;
const hardBtn = document.getElementById('hard') as HTMLInputElement;

startGameBtn.addEventListener('click', startGame);
soundCheckBox.addEventListener('change', function (): void {
  if (this.checked) {
    setSound(true);
  } else {
    setSound(false);
  }
});

musicCheckBox.addEventListener('change', function (): void {
  if (this.checked) {
    setMusic(true);
  } else {
    setMusic(false);
  }
});

easyBtn.addEventListener('change', function (): void {
  if (this.checked) {
    setDifficulty('easy');
  }
});

medBtn.addEventListener('change', function (): void {
  if (this.checked) {
    setDifficulty('medium');
  }
});

hardBtn.addEventListener('change', function (): void {
  if (this.checked) {
    setDifficulty('hard');
  }
});

function toggleScreen(id: string, toggle: boolean): void {
  const element = document.getElementById(id);
  const display = toggle ? 'block' : 'none';
  if (element) {
    element.style.display = display;
  } else {
    throw Error(`element with id: ${id} could not be found`);
  }
}

export { toggleScreen, startGameBtn };
