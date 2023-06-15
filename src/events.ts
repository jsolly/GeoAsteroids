import { keyDown, keyUp } from './keybindings.js';
import { setSound, setMusic } from './soundsMusic.js';
import { setDifficulty, Difficulty, FPS } from './config.js';
import { ship, newGame, update, currScore } from './main.js';

document.addEventListener('keydown', (ev) => keyDown(ev, ship)); // pass ship to keyDown
document.addEventListener('keyup', (ev) => keyUp(ev, ship)); // pass ship to keyUp

let gameInterval: NodeJS.Timer;

interface HighScore {
  name: string;
  score: number;
}

function startGame(): void {
  newGame();
  toggleScreen('start-screen', false);
  toggleScreen('gameArea', true);
  // Set up game loop
  gameInterval = setInterval(update, 1000 / FPS);
}

const difficultyButtonMap: Record<string, Difficulty> = {
  easy: Difficulty.easy,
  medium: Difficulty.medium,
  hard: Difficulty.hard,
};

function toggleScreen(id: string, toggle: boolean): void {
  const element = getElementById<HTMLElement>(id);
  if (element) {
    element.style.display = toggle ? 'block' : 'none';
  }
}

async function postHighScore(highScore: HighScore): Promise<void> {
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
    console.error('There has been a problem with your fetch operation:', error);
  }
}

function validateInput(input: HTMLInputElement): void {
  input.value = input.value.replace(/[^A-Za-z0-9]/g, '');
}

function showGameOverMenu(): void {
  clearInterval(gameInterval); // Stop the game loop

  // Show the game over modal
  const gameOverModal = getElementById<HTMLElement>('gameOverModal');
  if (gameOverModal) {
    gameOverModal.style.display = 'block';
  }
}

async function submitName(): Promise<void> {
  const nameInput = getElementById<HTMLInputElement>('nameInput');
  if (!nameInput) {
    return;
  }

  validateInput(nameInput);
  const name = nameInput.value;

  // Call Serverside API to save score
  const highScore: HighScore = { name, currScore };
  await postHighScore(highScore);

  // Hide the game over modal
  const gameOverModal = getElementById<HTMLElement>('gameOverModal');
  if (gameOverModal) {
    gameOverModal.style.display = 'none';
  }

  // Clear the input field for the next game
  nameInput.value = '';

  newGame();
  clearInterval(gameInterval);
  const startGameBtn = getElementById<HTMLButtonElement>('start-game');
  if (startGameBtn) {
    startGameBtn.innerText = 'Play Again! 🚀';
  }

  toggleScreen('start-screen', true);
  toggleScreen('gameArea', false);
}

function getElementById<T extends HTMLElement>(id: string): T | null {
  const element = document.getElementById(id);
  if (!element) {
    console.error(`Element with id '${id}' not found`);
  }
  return element as T | null;
}

type EventCallback = ((ev: Event) => void) | ((ev: Event) => Promise<void>);

function attachEventListener<T extends HTMLElement>(
  element: T | null,
  eventType: string,
  callback: EventCallback,
): void {
  if (element) {
    element.addEventListener(eventType, (ev) => {
      const result = callback(ev);
      if (result instanceof Promise) {
        result.catch((error) => console.error(error));
      }
    });
  } else {
    console.error(`Unable to attach event listener, element not found`);
  }
}

const startGameBtn = getElementById<HTMLButtonElement>('start-game');
const soundCheckBox = getElementById<HTMLInputElement>('soundPref');
const musicCheckBox = getElementById<HTMLInputElement>('musicPref');
const nameInput = getElementById<HTMLInputElement>('nameInput');
const submitNameButton = getElementById<HTMLButtonElement>('submitNameButton');

attachEventListener(startGameBtn, 'click', startGame);
attachEventListener(soundCheckBox, 'change', (ev) => {
  const target = ev.target as HTMLInputElement;
  setSound(target.checked);
});

attachEventListener(musicCheckBox, 'change', (ev) => {
  const target = ev.target as HTMLInputElement;
  setMusic(target.checked);
});

if (nameInput && submitNameButton) {
  attachEventListener(nameInput, 'input', () => validateInput(nameInput));
  attachEventListener(submitNameButton, 'click', submitName);
}

Object.entries(difficultyButtonMap).forEach(([id, difficulty]) => {
  const btn = document.getElementById(id) as HTMLInputElement;
  attachEventListener(btn, 'change', (ev) => {
    const target = ev.target as HTMLInputElement;
    if (target.checked) {
      setDifficulty(difficulty);
    }
  });
});

export { showGameOverMenu };
