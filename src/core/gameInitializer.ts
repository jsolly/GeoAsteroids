import { initializeCanvas } from '../constants';

/**
 * Handles game initialization that should happen when the application starts
 */
export function initializeGame(): void {
  // Test that logging is working
  console.info('GAME_INITIALIZER', 'Game initialization started');

  // Initialize canvas with proper scaling after DOM is loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeCanvas);
  } else {
    initializeCanvas();
  }
}

/**
 * Sets up periodic game updates that should run continuously
 */
export async function setupPeriodicUpdates(): Promise<void> {
  // Import main menu updates after it's loaded
  const { setupMainMenuUpdates } = await import('../ui/mainMenu.ts');
  setupMainMenuUpdates();
}
