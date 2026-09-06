import { VISUAL } from '../../constants';

export type HudClusterLayout = {
  lifeCenters: { x: number; y: number }[];
  score: { x: number; y: number };
};

export function layoutHudCluster(lives: number): HudClusterLayout {
  const inset = VISUAL.HUD_INSET;
  const size = VISUAL.HUD_LIFE_SIZE;
  const gap = VISUAL.HUD_LIFE_GAP;
  const radius = size / 2;
  const lifeCenters: { x: number; y: number }[] = [];

  for (let i = 0; i < lives; i++) {
    lifeCenters.push({
      x: inset + radius + i * (size + gap),
      y: inset + radius,
    });
  }

  const lastRight = lives > 0 ? inset + lives * size + (lives - 1) * gap : inset;
  const scoreX = lives > 0 ? lastRight + VISUAL.HUD_SCORE_GAP : inset;

  return {
    lifeCenters,
    score: { x: scoreX, y: inset + radius },
  };
}
