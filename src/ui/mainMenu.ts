// Console overrides and error handling are now handled by logLevel.ts which loads first

// Simple logging - removed complex logger dependency
import { setMusic } from '../audio/Music';
import { setSound } from '../audio/Sound';

import { GameController } from '../core/gameController';

import { attachEventListener, getElementById } from '../utils/dom';
import { toggleScreen } from './uiUtils';

// toggleScreen lives in uiUtils

// UI element references
const soundCheckBox = getElementById<HTMLInputElement>('soundPref');
const musicCheckBox = getElementById<HTMLInputElement>('musicPref');

const startMultiplayerBtn = getElementById<HTMLButtonElement>('start-multiplayer');
const startDebugBtn = getElementById<HTMLButtonElement>('start-debug');
const debugButtonContainer = getElementById<HTMLElement>('debug-button-container');
const playerCountElement = getElementById<HTMLElement>('playerCount');

// Multiplayer name input elements
const multiplayerNameModal = getElementById<HTMLElement>('multiplayerNameModal');
const multiplayerNameInput = getElementById<HTMLInputElement>('multiplayerNameInput');
const confirmNameButton = getElementById<HTMLButtonElement>('confirmNameButton');
const cancelNameButton = getElementById<HTMLButtonElement>('cancelNameButton');

// Helper function to get game controller instance
function getGameController() {
  return GameController.getInstance();
}

// Function to update player count display
function updatePlayerCount(): void {
  if (playerCountElement) {
    const gameController = getGameController();
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

// Check if we're in development mode
const isDevelopmentMode = import.meta.env?.DEV === true || import.meta.env?.MODE === 'development';

// Show debug button only in development mode
if (isDevelopmentMode && debugButtonContainer) {
  debugButtonContainer.style.display = 'block';
}

// Multiplayer is now the only mode - always enabled

// Set up multiplayer button - this is now the only game mode
attachEventListener(startMultiplayerBtn, 'click', () => {
  showMultiplayerNameModal();
});

// Set up debug button - only available in development mode
if (startDebugBtn) {
  attachEventListener(startDebugBtn, 'click', () => {
    startDebugMode();
  });
}

// Update player count display initially
updatePlayerCount();

// Function to check if scrolling is needed and show/hide scroll indicator
function updateScrollIndicator(): void {
  const screenElement = document.getElementById('start-screen');
  const scrollIndicator = document.querySelector('.scroll-indicator') as HTMLElement;

  if (screenElement && scrollIndicator) {
    const isScrollable = screenElement.scrollHeight > screenElement.clientHeight;
    scrollIndicator.style.display = isScrollable ? 'block' : 'none';
  }
}

// Function to show multiplayer name input modal
function showMultiplayerNameModal(): void {
  if (multiplayerNameModal && multiplayerNameInput) {
    const gameController = getGameController();
    multiplayerNameModal.style.display = 'block';

    // Pre-fill with last used name if available
    const existing = gameController.getMultiplayerManager().getLocalPlayerName();
    if (existing) {
      multiplayerNameInput.value = existing;
    } else {
      multiplayerNameInput.value = '';
    }

    multiplayerNameInput.focus();
  }
}

// Function to hide multiplayer name input modal
function hideMultiplayerNameModal(): void {
  if (multiplayerNameModal) {
    multiplayerNameModal.style.display = 'none';
  }
}

// Function to start debug mode
function startDebugMode(): void {
  // Import and use the debug manager
  import('../debug/index').then(({ DebugManager }) => {
    const debugManager = DebugManager.getInstance();

    // Enable debug mode
    debugManager.enableDebugMode();

    // Get the debug game controller and start the game
    const debugGameController = debugManager.getDebugGameController();

    // Update button state
    startDebugBtn?.classList.add('active-mode');

    // Start the game in debug mode
    debugGameController.startGame();
  });
}

// Function to start multiplayer with the entered name
function startMultiplayerWithName(): void {
  if (multiplayerNameInput?.value.trim()) {
    const playerNameRaw = multiplayerNameInput.value.trim();

    // Apply name validation
    const MAX_LEN = 20;
    const playerName = playerNameRaw.slice(0, MAX_LEN);

    // Validate player name (alphanumeric only)
    const validatedName = playerName.replace(/[^A-Za-z0-9]/g, '');

    if (validatedName) {
      // Set the player name in the game controller
      const gameController = getGameController();
      gameController.setPlayerName(validatedName);

      // Hide the modal
      hideMultiplayerNameModal();

      // Enable multiplayer and start the game
      gameController.enableMultiplayer();

      // Update button state
      startMultiplayerBtn?.classList.add('active-mode');

      // Update player count immediately
      updatePlayerCount();

      // Start the game
      gameController.startGame();
    } else {
      // Show error feedback for invalid name
      multiplayerNameInput?.focus();
      // Optionally add visual feedback here
    }
  } else {
    // Show error or focus the input
    multiplayerNameInput?.focus();
  }
}

// Set up confirm name button in multiplayer modal
if (confirmNameButton) {
  attachEventListener(confirmNameButton, 'click', startMultiplayerWithName);
}

// Set up cancel name button in multiplayer modal
if (cancelNameButton) {
  attachEventListener(cancelNameButton, 'click', hideMultiplayerNameModal);
}

// Set up multiplayer name input in multiplayer modal
if (multiplayerNameInput) {
  attachEventListener(multiplayerNameInput, 'keydown', (ev) => {
    if ((ev as KeyboardEvent).key === 'Enter') {
      startMultiplayerWithName();
    }
  });
}

// Check scroll indicator on load and resize
updateScrollIndicator();
window.addEventListener('resize', updateScrollIndicator);

attachEventListener(soundCheckBox, 'change', (ev) => {
  const target = ev.target as HTMLInputElement;
  setSound(target.checked);
});

attachEventListener(musicCheckBox, 'change', (ev) => {
  const target = ev.target as HTMLInputElement;
  setMusic(target.checked);
});

export function showGameOverMenu(): void {
  // Return to main menu
  toggleScreen('start-screen', true);
  toggleScreen('gameArea', false);

  // Do not reset game state here; let the next start initialize cleanly
}

// Export function to set up periodic updates
export function setupMainMenuUpdates(): void {
  // Set up periodic player count updates (every 2 seconds)
  setInterval(updatePlayerCount, 2000);
}
