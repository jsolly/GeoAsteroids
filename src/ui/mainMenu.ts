// Console overrides and error handling are now handled by logLevel.ts which loads first

import { setSound } from '../audio/Sound';
// Simple logging - removed complex logger dependency
import { GameController } from '../core/gameController';
import { initTitleStarfield } from '../rendering/starfield';
import { getBuildInfoString } from '../utils/buildInfo';
import { applyLockedPaletteCss } from '../utils/colorUtils';
import { attachEventListener, getElementById } from '../utils/dom';
import { logger } from '../utils/Logger';
import { setPlayView } from './uiUtils';

// UI element references
const soundCheckBox = getElementById<HTMLInputElement>('soundPref');
const startGameBtn = getElementById<HTMLButtonElement>('start-game');
const playerNameInput = getElementById<HTMLInputElement>('playerNameInput');

// Helper function to get game controller instance
function getGameController() {
  return GameController.getInstance();
}

// Generate fun, space-themed nicknames
function generateFunNickname(): string {
  const adjectives = [
    'Crimson',
    'Nebula',
    'Quantum',
    'Cosmic',
    'Lunar',
    'Solar',
    'Galactic',
    'Star',
    'Nova',
    'Meteor',
    'Stellar',
    'Astral',
    'Celestial',
    'Orbital',
    'Interstellar',
    'Void',
    'Ethereal',
    'Mystic',
    'Shadow',
    'Phantom',
    'Blazing',
    'Frozen',
    'Thunder',
    'Lightning',
    'Storm',
    'Titan',
    'Dragon',
    'Phoenix',
    'Wolf',
    'Eagle',
    'Cyber',
    'Neon',
    'Digital',
    'Pixel',
    'Retro',
    'Future',
    'Time',
    'Space',
    'Dimension',
    'Reality',
  ];

  const nouns = [
    'Falcon',
    'Viper',
    'Ranger',
    'Specter',
    'Comet',
    'Warden',
    'Drifter',
    'Marauder',
    'Pioneer',
    'Corsair',
    'Guardian',
    'Sentinel',
    'Hunter',
    'Warrior',
    'Knight',
    'Mage',
    'Archer',
    'Assassin',
    'Paladin',
    'Rogue',
    'Blade',
    'Sword',
    'Shield',
    'Armor',
    'Helmet',
    'Crown',
    'Throne',
    'Tower',
    'Castle',
    'Fortress',
    'Storm',
    'Thunder',
    'Lightning',
    'Fire',
    'Ice',
    'Wind',
    'Earth',
    'Water',
    'Light',
    'Dark',
  ];

  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${adjective} ${noun}`;
}

// Set up game button - directly start game with nickname input
attachEventListener(startGameBtn, 'click', () => {
  startGameWithName();
});

// Function to start game with the entered name
function startGameWithName(): void {
  let playerName = '';

  logger.debug('UI', 'startGameWithName called');
  logger.debug('UI', `Input value: ${playerNameInput?.value}`);
  logger.debug('UI', `Input value trimmed: ${playerNameInput?.value.trim()}`);

  if (playerNameInput?.value.trim()) {
    const playerNameRaw = playerNameInput.value.trim();

    // Apply name validation
    const MAX_LEN = 20;
    const validatedName = playerNameRaw.slice(0, MAX_LEN);

    // Validate player name (alphanumeric only)
    playerName = validatedName.replace(/[^A-Za-z0-9]/g, '');

    logger.debug('UI', `Using user-entered name: ${playerName}`);
  }

  // If no valid name entered, use the pre-generated nickname
  if (!playerName) {
    playerName = generatedNickname;
    logger.debug('UI', `Using pre-generated nickname: ${playerName}`);

    // Update the input field to show the nickname
    if (playerNameInput) {
      playerNameInput.value = playerName;
      playerNameInput.classList.add('default-nickname');
    }
  } else {
    // Remove default nickname styling if user entered a custom name
    if (playerNameInput) {
      playerNameInput.classList.remove('default-nickname');
    }
  }

  logger.debug('UI', `Final player name: ${playerName}`);
  logger.debug('UI', `About to call getGameController().startGame(${playerName})`);

  // Update button state
  startGameBtn?.classList.add('active-mode');

  // Start the game (this will set the player name)
  getGameController().startGame(playerName);
}

// Set up player name input to allow Enter key to start game
if (playerNameInput) {
  attachEventListener(playerNameInput, 'keydown', (ev) => {
    if ((ev as KeyboardEvent).key === 'Enter') {
      startGameWithName();
    }
  });

  // Clear default nickname styling when user starts typing
  attachEventListener(playerNameInput, 'input', () => {
    playerNameInput.classList.remove('default-nickname');
  });
}

attachEventListener(soundCheckBox, 'change', (ev) => {
  const target = ev.target as HTMLInputElement;
  setSound(target.checked);
});

export function showGameOverMenu(): void {
  setPlayView(false);
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
applyLockedPaletteCss();
initTitleStarfield();

// Generate a nickname once and use it consistently
const generatedNickname = generateFunNickname();

// Set the generated nickname as placeholder
if (playerNameInput) {
  playerNameInput.placeholder = generatedNickname;
  logger.debug('UI', `Set placeholder nickname: ${generatedNickname}`);
}
