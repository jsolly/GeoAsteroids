import { canvasManager } from '../rendering/canvas';
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
      console.error('EVENT_LOOP', 'Error in game loop', { error });
    }

    window.requestAnimationFrame(gameLoop);
  }

  window.requestAnimationFrame(gameLoop);
});
