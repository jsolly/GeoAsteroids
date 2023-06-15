import { keyDown, keyUp } from './keybindings.js';
import { setSound, setMusic } from './soundsMusic.js';
import { setDifficulty, Difficulty, FPS } from './config.js';

import { ship, newGame, update, currScore } from './main.js';
document.addEventListener('keydown', (ev) => keyDown(ev, ship)); // pass ship to keyDown
document.addEventListener('keyup', (ev) => keyUp(ev, ship)); // pass ship to keyUp

const startGameBtn = document.getElementById('start-game') as HTMLButtonElement;
const soundCheckBox = document.getElementById('soundPref') as HTMLInputElement;
const musicCheckBox = document.getElementById('musicPref') as HTMLInputElement;
const easyBtn = document.getElementById('easy') as HTMLInputElement;
const medBtn = document.getElementById('medium') as HTMLInputElement;
const hardBtn = document.getElementById('hard') as HTMLInputElement;
let gameInterval: NodeJS.Timer;

interface HighScore {
  name: string;
  currScore: number;
}

function startGame(): void {
  newGame();
  toggleScreen('start-screen', false);
  toggleScreen('gameArea', true);
  // Set up game loop
  gameInterval = setInterval(update, 1000 / FPS);
}

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

async function showGameOverMenu(): Promise<void> {
  clearInterval(gameInterval); // Stop the game loop
  const name = prompt('Enter your name for the high score list:');
  if (name != null) {
    // Call Serverside API to save score
    const highScore: HighScore = { name, currScore };
    try {
      const response = await fetch('/api/highscores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(highScore),
      });
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
    } catch (error) {
      console.error(
        'There has been a problem with your fetch operation:',
        error,
      );
    }
  }

  newGame();
  clearInterval(gameInterval);
  startGameBtn.innerText = 'Play Again! 🚀';

  toggleScreen('start-screen', true);
  toggleScreen('gameArea', false);
}

export { toggleScreen, startGameBtn, Difficulty, showGameOverMenu };
