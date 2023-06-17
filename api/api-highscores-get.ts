import { VercelRequest, VercelResponse } from '@vercel/node';
import { getHighScores } from '../src/database';

export default async (
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> => {
  try {
    const highScores = await getHighScores();
    res.status(200).json({ highScores });
  } catch (error) {
    console.error(error);
    res.status(500).send('An error occurred while getting high scores.');
  }
};
