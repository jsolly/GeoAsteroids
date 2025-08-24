// Console overrides and error handling are now handled by logLevel.ts which loads first

import { setSound } from '../audio/Sound';
// Simple logging - removed complex logger dependency
import { GameController } from '../core/gameController';
import { getBuildInfoString } from '../utils/buildInfo';
import { attachEventListener, getElementById } from '../utils/dom';
import { toggleScreen } from './uiUtils';

// toggleScreen lives in uiUtils

// UI element references
const soundCheckBox = getElementById<HTMLInputElement>('soundPref');

const startMultiplayerBtn = getElementById<HTMLButtonElement>('start-multiplayer');

// Multiplayer name input elements
const multiplayerNameModal = getElementById<HTMLElement>('multiplayerNameModal');
const multiplayerNameInput = getElementById<HTMLInputElement>('multiplayerNameInput');
const confirmNameButton = getElementById<HTMLButtonElement>('confirmNameButton');
const cancelNameButton = getElementById<HTMLButtonElement>('cancelNameButton');

// Helper function to get game controller instance
function getGameController() {
  return GameController.getInstance();
}

// Multiplayer is now the only mode - always enabled

// Set up multiplayer button - this is now the only game mode
attachEventListener(startMultiplayerBtn, 'click', () => {
  showMultiplayerNameModal();
});

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

      // Update button state
      startMultiplayerBtn?.classList.add('active-mode');

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

attachEventListener(soundCheckBox, 'change', (ev) => {
  const target = ev.target as HTMLInputElement;
  setSound(target.checked);
});

export function showGameOverMenu(): void {
  // Return to main menu
  toggleScreen('start-screen', true);
  toggleScreen('gameArea', false);

  // Do not reset game state here; let the next start initialize cleanly
}

// Export function to set up periodic updates
export function setupMainMenuUpdates(): void {
  // Player count updates removed - no longer needed
}

// Display build info
function displayBuildInfo(): void {
  const buildInfoElement = getElementById<HTMLElement>('buildInfo');
  if (buildInfoElement) {
    buildInfoElement.textContent = getBuildInfoString();
  }
}

// Initialize build info display
displayBuildInfo();
