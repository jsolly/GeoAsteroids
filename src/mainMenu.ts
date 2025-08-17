import './logLevel'; // Import early to set up console overrides
import { getElementById, attachEventListener } from './utils';
import {
  validateInput,
  submitName,
  fetchHighScores,
} from './highScoreFetchGet';
import { setSound, setMusic } from './soundsMusic';
import { setDifficulty, Difficulty, initializeCanvas } from './constants';
import { GameController } from './gameController';
const gameController = GameController.getInstance();
const startGame = gameController.startGame.bind(gameController);

// Set up global error handlers immediately when the script loads
function setupErrorHandlers(): void {
  console.info('MAIN_MENU', 'Setting up global error handlers');

  // Capture JavaScript errors
  window.addEventListener('error', (event: ErrorEvent) => {
    console.error('JAVASCRIPT_ERROR', 'JavaScript error occurred', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error:
        event.error instanceof Error
          ? event.error.stack || event.error.message
          : String(event.error),
    });
  });

  // Capture unhandled promise rejections
  window.addEventListener(
    'unhandledrejection',
    (event: PromiseRejectionEvent) => {
      console.error('UNHANDLED_PROMISE', 'Unhandled promise rejection', {
        reason: String(event.reason),
      });
    },
  );

  // Note: Console overrides are handled in logLevel.ts to prevent circular dependencies

  console.info('MAIN_MENU', 'Global error handlers installed successfully');
}

// Set up error handlers immediately
setupErrorHandlers();

// Initialize canvas with proper scaling after DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeCanvas);
} else {
  initializeCanvas();
}

// Test logging to verify it's working
console.info('MAIN_MENU', 'Main menu script loaded successfully');

const soundCheckBox = getElementById<HTMLInputElement>('soundPref');
const musicCheckBox = getElementById<HTMLInputElement>('musicPref');
const nameInput = getElementById<HTMLInputElement>('nameInput');
const submitNameButton = getElementById<HTMLButtonElement>('submitNameButton');
const highScoresButton = getElementById<HTMLButtonElement>(
  'showHighScoresButton',
);
const startSinglePlayerBtn = getElementById<HTMLButtonElement>(
  'start-single-player',
);
const startMultiplayerBtn =
  getElementById<HTMLButtonElement>('start-multiplayer');

// Set up single player button - ensures multiplayer is disabled
attachEventListener(startSinglePlayerBtn, 'click', () => {
  gameController.disableMultiplayer();
  // Update button states
  startSinglePlayerBtn?.classList.add('active-mode');
  startMultiplayerBtn?.classList.remove('active-mode');
  startGame();
});

// Set up multiplayer button - ensures multiplayer is enabled
attachEventListener(startMultiplayerBtn, 'click', () => {
  gameController.enableMultiplayer();
  // Update button states
  startMultiplayerBtn?.classList.add('active-mode');
  startSinglePlayerBtn?.classList.remove('active-mode');
  startGame();
});

// Set initial active button state - default to single player
if (startSinglePlayerBtn && startMultiplayerBtn) {
  startSinglePlayerBtn.classList.add('active-mode');
}

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

// Remove the multiplayer checkbox handler since we're using buttons now

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
  gameController.toggleIsGameRunning();

  // Show the game over modal
  const gameOverModal = getElementById<HTMLElement>('gameOverModal');
  if (gameOverModal) {
    gameOverModal.style.display = 'block';
  }
}

export { toggleScreen, showGameOverMenu };
