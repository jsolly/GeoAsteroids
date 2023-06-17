import { VercelRequest, VercelResponse } from '@vercel/node';
import { getHighScores, updateHighScores } from './database';

interface HighScore {
  name: string;
  score: number;
}

export default async (req: VercelRequest, res: VercelResponse) => {
  switch (req.method) {
    case 'GET':
      try {
        const highScores = await getHighScores();
        res.status(200).json({ highScores });
      } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred while getting high scores.');
      }
      break;
    case 'POST':
      try {
        const newScore = req.body as HighScore;
        await updateHighScores(newScore);
        res.status(200).json({ newScore });
      } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred while updating high scores.');
      }
      break;
    default:
      res.status(405).send('Method not allowed');
      break;
  }
};
