import { canvasManager } from '../rendering/canvas';
import { logger } from '../utils/Logger';
import { GameController } from './gameController';

const gameController = GameController.getInstance();

// Initialize canvas with proper scaling after DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => canvasManager.initialize());
} else {
  canvasManager.initialize();
}

// Set up main menu updates
(async () => {
  const { setupMainMenuUpdates } = await import('../ui/mainMenu');
  setupMainMenuUpdates();
})();

// Game loop with updates and rendering
window.addEventListener('gameStart', () => {
  function gameLoop(): void {
    if (!gameController.getIsGameRunning()) {
      return;
    }

    try {
      // Update game state first
      gameController.updateGame();

      // Then render the current game state
      gameController.renderGame();
    } catch (error) {
      logger.error(
        'GAME_LOOP',
        'Error in game loop',
        error instanceof Error ? error : new Error(String(error))
      );
    }

    window.requestAnimationFrame(gameLoop);
  }

  window.requestAnimationFrame(gameLoop);
});
