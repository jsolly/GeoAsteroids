export interface Boundary {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function getGameBoundary(): Boundary {
  // Use a fixed world boundary that's large enough for the game
  // This creates a boundary around the visible game area
  const boundarySize = 2000; // Large enough to contain the game world
  const buffer = 100; // Buffer space before ships are killed

  return {
    x: -boundarySize / 2 - buffer,
    y: -boundarySize / 2 - buffer,
    width: boundarySize + buffer * 2,
    height: boundarySize + buffer * 2,
  };
}
