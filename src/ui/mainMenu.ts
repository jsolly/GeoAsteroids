import { setupConsoleOverride } from '../utils/logLevel'; // Import early to set up console overrides

// Set up console overrides immediately
setupConsoleOverride();

// Simple logging - removed complex logger dependency
import { setMusic } from '../audio/Music';
import { setSound } from '../audio/Sound';
import { Difficulty, initializeCanvas, setDifficulty } from '../constants';
import { GameController } from '../core/gameController';
import { fetchHighScores, submitName, validateInput } from '../services/highScoreService';
import { attachEventListener, getElementById } from '../utils/dom';

// toggleScreen lives in uiUtils; mainMenu imports it via highScoreService when needed

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
  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    console.error('UNHANDLED_PROMISE', 'Unhandled promise rejection', {
      reason: String(event.reason),
    });
  });

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
const highScoresButton = getElementById<HTMLButtonElement>('showHighScoresButton');
const startSinglePlayerBtn = getElementById<HTMLButtonElement>('start-single-player');
const startMultiplayerBtn = getElementById<HTMLButtonElement>('start-multiplayer');
const playerCountElement = getElementById<HTMLElement>('playerCount');

// Function to update player count display
function updatePlayerCount(): void {
  if (playerCountElement) {
    const currentCount = parseInt(playerCountElement.textContent || '1', 10);
    const playerCount = gameController.getPlayerCount();

    // Only update if the count actually changed
    if (currentCount !== playerCount) {
      playerCountElement.textContent = playerCount.toString();

      // Add animation class
      playerCountElement.classList.add('updated');

      // Remove animation class after animation completes
      setTimeout(() => {
        playerCountElement.classList.remove('updated');
      }, 600);

      // Update the heading text to be grammatically correct
      const heading = playerCountElement.closest('h4');
      if (heading) {
        heading.innerHTML = `🌐 <span id="playerCount">${playerCount}</span> ${playerCount === 1 ? 'Player' : 'Players'} Online`;
      }
    }
  }
}

// Expose updatePlayerCount to window for testing
if (typeof window !== 'undefined') {
  (window as { updatePlayerCount?: typeof updatePlayerCount }).updatePlayerCount =
    updatePlayerCount;
}

// Set up single player button - ensures multiplayer is disabled
attachEventListener(startSinglePlayerBtn, 'click', () => {
  gameController.disableMultiplayer();
  // Update button states
  startSinglePlayerBtn?.classList.add('active-mode');
  startMultiplayerBtn?.classList.remove('active-mode');
  // Update player count immediately
  updatePlayerCount();
  startGame();
});

// Set up multiplayer button - ensures multiplayer is enabled
attachEventListener(startMultiplayerBtn, 'click', () => {
  gameController.enableMultiplayer();
  // Update button states
  startMultiplayerBtn?.classList.add('active-mode');
  startSinglePlayerBtn?.classList.remove('active-mode');
  // Update player count immediately
  updatePlayerCount();
  startGame();
});

// Set initial active button state - default to single player
if (startSinglePlayerBtn && startMultiplayerBtn) {
  startSinglePlayerBtn.classList.add('active-mode');
}

// Update player count display initially and set up periodic updates
updatePlayerCount();

// Set up periodic player count updates (every 2 seconds)
setInterval(updatePlayerCount, 2000);

// Function to check if scrolling is needed and show/hide scroll indicator
function updateScrollIndicator(): void {
  const screenElement = document.getElementById('start-screen');
  const scrollIndicator = document.querySelector('.scroll-indicator') as HTMLElement;

  if (screenElement && scrollIndicator) {
    const isScrollable = screenElement.scrollHeight > screenElement.clientHeight;
    scrollIndicator.style.display = isScrollable ? 'block' : 'none';
  }
}

// Check scroll indicator on load and resize
updateScrollIndicator();
window.addEventListener('resize', updateScrollIndicator);

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

// toggleScreen moved to uiUtils.ts to reduce coupling

export function showGameOverMenu(): void {
  gameController.toggleIsGameRunning();

  // Show the game over modal
  const gameOverModal = getElementById<HTMLElement>('gameOverModal');
  if (gameOverModal) {
    gameOverModal.style.display = 'block';
  }
}

// Set default difficulty to ensure asteroids are created
setDifficulty(Difficulty.medium);
