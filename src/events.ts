import { keyDown, keyUp } from './keybindings.js';
import { setSound, setMusic } from './soundsMusic.js';
import { setDifficulty, Difficulty } from './config.js';

import { startGame, ship } from './main.js';
document.addEventListener('keydown', (ev) => keyDown(ev, ship)); // pass ship to keyDown
document.addEventListener('keyup', (ev) => keyUp(ev, ship)); // pass ship to keyUp

const startGameBtn = document.getElementById('start-game') as HTMLButtonElement;
const soundCheckBox = document.getElementById('soundPref') as HTMLInputElement;
const musicCheckBox = document.getElementById('musicPref') as HTMLInputElement;
const easyBtn = document.getElementById('easy') as HTMLInputElement;
const medBtn = document.getElementById('medium') as HTMLInputElement;
const hardBtn = document.getElementById('hard') as HTMLInputElement;

startGameBtn.addEventListener('click', startGame);
soundCheckBox.addEventListener('change', function (): void {
  setSound(this.checked);
});

musicCheckBox.addEventListener('change', function (): void {
  setMusic(this.checked);
});

easyBtn.addEventListener('change', function (): void {
  if (this.checked) {
    setDifficulty(Difficulty.easy);
  }
});

medBtn.addEventListener('change', function (): void {
  if (this.checked) {
    setDifficulty(Difficulty.medium);
  }
});

hardBtn.addEventListener('change', function (): void {
  if (this.checked) {
    setDifficulty(Difficulty.hard);
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

export { toggleScreen, startGameBtn, Difficulty };
