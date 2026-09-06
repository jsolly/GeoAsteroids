import { ARENA } from '../constants';

export interface CircleBoundary {
  cx: number;
  cy: number;
  radius: number;
}

const GAME_BOUNDARY: CircleBoundary = {
  cx: 0,
  cy: 0,
  radius: ARENA.BOUNDARY_DIAMETER / 2 + ARENA.BOUNDARY_BUFFER,
};

export function getGameBoundary(): CircleBoundary {
  return GAME_BOUNDARY;
}
