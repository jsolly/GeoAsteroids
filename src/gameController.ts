import { GameState } from './gameState';
import { Music } from './soundsMusic';
import { Ship } from './ship';
import { RoidBelt } from './asteroids';
import { newLevelText, setTextProperties } from './canvas';
import { toggleScreen } from './mainMenu';
import { setIsGameRunning, gameLoop } from './eventLoop';

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
  getNextLevel(): number;
  getCurrScore(): number;
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
    newLevelText(this.gameState.getCurrentLevel());
    this.currRoidBelt.addRoid(this.currShip);
    this.music.setMusicTempo(1.0 + this.gameState.getCurrentLevel() / 10);
  }

  newGame(): void {
    this.gameState.resetCurrentScore();
    this.gameState.resetCurrentLevel();
    newLevelText(this.gameState.getCurrentLevel());
    this.currShip = new Ship();
    this.currRoidBelt = new RoidBelt(this.currShip);
    this.music.setMusicTempo(1.0);
  }

  startGame(): void {
    this.newGame();
    toggleScreen('start-screen', false);
    toggleScreen('gameArea', true);
    setIsGameRunning(true);
    window.requestAnimationFrame(gameLoop);
  }

  gameOver(): void {
    this.currShip.die();
    setTextProperties('Game Over', 1.0);
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
}

export { GameController };
