import { GameState } from './gameState';
import { Music } from './soundsMusic';
import { Ship } from './ship';
import { RoidBelt } from './asteroids';
import { toggleScreen } from './mainMenu';
import { keyDown, keyUp } from './keybindings';

function initializeListeners(isGameRunning: () => boolean): void {
  document.addEventListener('keydown', (ev) => {
    if (isGameRunning()) {
      keyDown(ev, GameController.getInstance().getCurrShip());
    }
  });

  document.addEventListener('keyup', (ev) => {
    if (isGameRunning()) {
      keyUp(ev, GameController.getInstance().getCurrShip());
    }
  });
}

interface IGameController {
  levelUp(): void;
  newGame(): void;
  startGame(): void;
  gameOver(): void;
  tickMusic(): void;
  getCurrShip(): Ship;
  getCurrRoidBelt(): RoidBelt;
  updateCurrScore(points: number): void;
  updatePersonalBest(): void;
  updateTextProperties(text: string, alpha: number): void;
  getNextLevel(): number;
  getCurrScore(): number;
  getIsGameRunning(): boolean;
  toggleIsGameRunning(): void;
}

class GameController implements IGameController {
  private static instance: GameController;
  private gameState: GameState;
  private music: Music;
  private currShip: Ship;
  private currRoidBelt: RoidBelt;

  private constructor() {
    this.gameState = GameState.getInstance();
    this.music = new Music('sounds/music-low.m4a', 'sounds/music-high.m4a');
    this.currShip = new Ship();
    this.currRoidBelt = new RoidBelt(this.currShip);
  }

  public static getInstance(): GameController {
    if (!GameController.instance) {
      GameController.instance = new GameController();
    }
    return GameController.instance;
  }

  levelUp(): void {
    this.gameState.updateCurrentLevel();
    this.gameState.updateNextLevel();
    const currLevel = this.gameState.getCurrentLevel();
    const text = 'Level ' + String(currLevel);
    const textAlpha = 1.0;
    this.updateTextProperties(text, textAlpha);
    this.currRoidBelt.addRoid(this.currShip);
    this.music.setMusicTempo(1.0 + this.gameState.getCurrentLevel() / 10);
  }

  newGame(): void {
    this.gameState.resetCurrentScore();
    this.gameState.resetCurrentLevel();
    this.currShip = new Ship();
    this.currRoidBelt = new RoidBelt(this.currShip);
    this.music.setMusicTempo(1.0);
  }

  startGame(): void {
    this.newGame();
    toggleScreen('start-screen', false);
    toggleScreen('gameArea', true);
    this.toggleIsGameRunning();
    initializeListeners(() => this.getIsGameRunning());
    window.dispatchEvent(new CustomEvent('gameStart'));
  }

  gameOver(): void {
    this.currShip.die();
    this.updateTextProperties('Game Over', 1.0);
    this.music.setMusicTempo(1.0);
  }

  tickMusic(): void {
    this.music.tick();
  }
  getCurrShip(): Ship {
    return this.currShip;
  }
  getCurrRoidBelt(): RoidBelt {
    return this.currRoidBelt;
  }
  updateCurrScore(points: number): void {
    this.gameState.updateCurrentScore(points);
  }
  updatePersonalBest(): void {
    this.gameState.updatePersonalBest();
  }
  getPersonalBest(): number {
    return this.gameState.getPersonalBest();
  }

  getNextLevel(): number {
    return this.gameState.getNextLevel();
  }
  getCurrScore(): number {
    return this.gameState.getCurrentScore();
  }
  updateTextProperties(text: string, alpha: number): void {
    this.gameState.updateTextProperties(text, alpha);
  }
  updateTextAlpha(alpha: number): void {
    this.gameState.updateTextAlpha(alpha);
  }
  getTextAlpha(): number {
    return this.gameState.getTextAlpha();
  }
  getText(): string {
    return this.gameState.getText();
  }
  getIsGameRunning(): boolean {
    return this.gameState.getIsGameRunning();
  }
  toggleIsGameRunning(): void {
    this.gameState.toggleIsGameRunning();
  }
}

export { GameController };
