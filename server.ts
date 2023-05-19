import express, { Request, Response } from 'express';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';

const app = express();

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

app.use(express.json()); // for parsing application/json

app.get('/api/highscores', (_, res: Response) => {
  void (async () => {
    const highScores = await getHighScores();
    res.json({ highScores });
  })();
});

app.post('/api/highscores', (req: Request, res: Response) => {
  void (async () => {
    const newScore = req.body as HighScore;
    await updateHighScores(newScore);
    res.json({ newScore });
  })();
});

// Serve static files from the Vite build
app.use(express.static(path.join(__dirname, 'dist')));

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
