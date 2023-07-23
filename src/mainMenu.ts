import { getElementById, attachEventListener } from './utils';
import { startGame } from './runtimeVars';
import { setIsGameRunning } from './eventLoop';
import {
  validateInput,
  submitName,
  fetchHighScores,
} from './highScoreFetchGet';
import { setSound, setMusic } from './soundsMusic';
import { setDifficulty, Difficulty } from './config';

const soundCheckBox = getElementById<HTMLInputElement>('soundPref');
const musicCheckBox = getElementById<HTMLInputElement>('musicPref');
const nameInput = getElementById<HTMLInputElement>('nameInput');
const submitNameButton = getElementById<HTMLButtonElement>('submitNameButton');
const highScoresButton = getElementById<HTMLButtonElement>(
  'showHighScoresButton',
);
const startGameBtn = getElementById<HTMLButtonElement>('start-game');
attachEventListener(startGameBtn, 'click', startGame);

const difficultyButtonMap: Record<string, Difficulty> = {
  easy: Difficulty.easy,
  medium: Difficulty.medium,
  hard: Difficulty.hard,
};

attachEventListener(highScoresButton, 'click', fetchHighScores);

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

function toggleScreen(id: string, toggle: boolean): void {
  const element = getElementById<HTMLElement>(id);
  if (element) {
    element.style.display = toggle ? 'block' : 'none';
  }
}

function showGameOverMenu(): void {
  setIsGameRunning(false);

  // Show the game over modal
  const gameOverModal = getElementById<HTMLElement>('gameOverModal');
  if (gameOverModal) {
    gameOverModal.style.display = 'block';
  }
}

export { toggleScreen, showGameOverMenu };
