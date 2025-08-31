import { canvasManager } from '../rendering/canvas';
import { logger } from '../utils/Logger';
import { GameController } from './gameController';
import { GameLoopManager } from './services/GameLoopManager';

const gameController = GameController.getInstance();
const gameLoopManager = GameLoopManager.getInstance();

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

// Main game loop event handler
window.addEventListener('gameStart', () => {
  // Set up bot shoot handler
  gameController.getPlayerManager().setupBotShootHandler();

  function gameLoop(): void {
    if (!gameController.getIsGameRunning()) {
      return;
    }

    try {
      gameLoopManager.updateGame();
    } catch (error) {
      logger.error(
        'EVENT_LOOP',
        'Error in game loop',
        error instanceof Error ? error : new Error(String(error))
      );
    }

    window.requestAnimationFrame(gameLoop);
  }

  window.requestAnimationFrame(gameLoop);
});
