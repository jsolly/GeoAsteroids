import { VercelRequest, VercelResponse } from '@vercel/node';
import { updateHighScores } from '../src/database';

interface HighScore {
  name: string;
  score: number;
}

export default async (
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> => {
  try {
    const newScore = req.body as HighScore;
    await updateHighScores(newScore);
    res.status(200).json({ newScore });
  } catch (error) {
    console.error(error);
    res.status(500).send('An error occurred while updating high scores.');
  }
};
