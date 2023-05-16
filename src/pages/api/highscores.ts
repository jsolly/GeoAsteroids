import { readFile, writeFile } from 'fs/promises';

const HIGH_SCORES_FILE = './highscores.json';

interface HighScore {
  name: string;
  score: number;
}

async function getHighScores(): Promise<HighScore[]> {
  const data = await readFile(HIGH_SCORES_FILE, 'utf-8');
  const highScores = JSON.parse(data) as HighScore[];
  return highScores;
}

async function updateHighScores(newScore: HighScore): Promise<void> {
  let highScores = await getHighScores();

  // If there are less than 10 scores, or the new score is higher than the lowest score
  if (
    highScores.length < 10 ||
    newScore.score > highScores[highScores.length - 1].score
  ) {
    highScores.push(newScore);
    highScores.sort((a, b) => b.score - a.score);
    if (highScores.length > 10) {
      highScores = highScores.slice(0, 10); // keep only the top 10 scores
    }

    await writeFile(HIGH_SCORES_FILE, JSON.stringify(highScores, null, 2));
  }
}

export async function get(): Promise<{ highScores: HighScore[] }> {
  const highScores = await getHighScores();
  return { highScores };
}

export async function post(
  newScore: HighScore,
): Promise<{ newScore: HighScore }> {
  await updateHighScores(newScore);
  return { newScore };
}
