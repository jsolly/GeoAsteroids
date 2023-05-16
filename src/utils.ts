import { SAVE_KEY_PERSONAL_BEST } from './config.js';
import fs from 'fs';
class Point {
  constructor(readonly x: number, readonly y: number) {}

  movePoint(x: number, y: number): Point {
    return new Point(x, y);
  }
  /**
   * Returns the euclidian distance from the Point instance to another Point instance.
   */
  distToPoint(targetPoint: Point): number {
    return Math.floor(
      Math.sqrt(
        Math.pow(this.x - targetPoint.x, 2) +
          Math.pow(this.y - targetPoint.y, 2),
      ),
    );
  }
}

/**
 *
 * @returns - The current personal best score from local storage.
 */
function getPersonalBest(): number {
  const personalBest = localStorage.getItem(SAVE_KEY_PERSONAL_BEST);
  if (personalBest == null) {
    localStorage.setItem(SAVE_KEY_PERSONAL_BEST, '0'); // set to 0 if null
    return 0;
  }
  return Number(localStorage.getItem(SAVE_KEY_PERSONAL_BEST));
}

function updatePersonalBest(currScore: number): void {
  const personalBest = getPersonalBest();
  if (currScore > personalBest) {
    localStorage.setItem(SAVE_KEY_PERSONAL_BEST, String(currScore));
  }
}

// Server-side code
const HIGH_SCORES_FILE = './highscores.json';

interface HighScore {
  name: string;
  score: number;
}

function getGlobalHighScores(): HighScore[] {
  function readHighScoresFile(): string {
    return fs.readFileSync(HIGH_SCORES_FILE, 'utf-8');
  }

  function parseHighScores(data: string): HighScore[] {
    return JSON.parse(data) as HighScore[];
  }

  const data = readHighScoresFile();
  const highScores = parseHighScores(data);
  return highScores;
}

function updateGlobalHighScores(name: string, newScore: number): void {
  let highScores: HighScore[] = getGlobalHighScores();

  // If there are less than 10 scores, or the new score is higher than the lowest score
  if (
    highScores.length < 10 ||
    newScore > highScores[highScores.length - 1].score
  ) {
    highScores.push({ name, score: newScore });
    highScores.sort((a, b) => b.score - a.score);
    if (highScores.length > 10) {
      highScores = highScores.slice(0, 10); // keep only the top 10 scores
    }

    fs.writeFileSync(HIGH_SCORES_FILE, JSON.stringify(highScores, null, 2));
  }
}

export { Point, getPersonalBest, updatePersonalBest, updateGlobalHighScores };
