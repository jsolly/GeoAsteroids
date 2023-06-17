import { setSound, setMusic } from './soundsMusic.js';
import { setDifficulty, Difficulty, FPS } from './config.js';
import { newGame, update, getCurrentScore } from './main.js';

const startGameBtn = getElementById<HTMLButtonElement>('start-game');
const soundCheckBox = getElementById<HTMLInputElement>('soundPref');
const musicCheckBox = getElementById<HTMLInputElement>('musicPref');
const nameInput = getElementById<HTMLInputElement>('nameInput');
const submitNameButton = getElementById<HTMLButtonElement>('submitNameButton');
const highScoresButton = getElementById<HTMLButtonElement>(
  'showHighScoresButton',
);
const highScoresList = getElementById<HTMLOListElement>('highScoresList');
const difficultyButtonMap: Record<string, Difficulty> = {
  easy: Difficulty.easy,
  medium: Difficulty.medium,
  hard: Difficulty.hard,
};

attachEventListener(highScoresButton, 'click', fetchHighScores);
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

let gameInterval: NodeJS.Timer;

interface HighScore {
  name: string;
  score: number;
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

function validateInput(input: HTMLInputElement): void {
  input.value = input.value.replace(/[^A-Za-z0-9]/g, '');
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

function startGame(): void {
  newGame();
  toggleScreen('start-screen', false);
  toggleScreen('gameArea', true);
  // Set up game loop
  gameInterval = setInterval(update, 1000 / FPS);
}

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
  const score = getCurrentScore();

  // Call Serverside API to save score
  const highScore: HighScore = { name, score };
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
interface HighScoresResponse {
  highScores: HighScore[];
}

async function fetchHighScores(): Promise<void> {
  try {
    const response = await fetch('/api/highscores');
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    const data = (await response.json()) as HighScoresResponse;

    if (highScoresList) {
      // Clear any existing scores
      highScoresList.innerHTML = '';

      // Add new scores
      data.highScores.forEach((score) => {
        const li = document.createElement('li');
        li.textContent = `${score.name}: ${score.score}`;
        highScoresList.appendChild(li);
      });
    }
  } catch (error) {
    console.error('There has been a problem with your fetch operation:', error);
  }
}

export { showGameOverMenu };
