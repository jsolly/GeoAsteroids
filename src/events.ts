import { keyDown, keyUp } from './keybindings.js';
import { startGame } from './main.js';
document.addEventListener('keydown', keyDown);
document.addEventListener('keyup', keyUp);
const startGameBtn = document.getElementById('start-game');
if (!startGameBtn?.innerText) {
  throw Error('Could not find start game element');
}

startGameBtn.addEventListener('click', startGame);

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
