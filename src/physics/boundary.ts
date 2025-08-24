export interface CircleBoundary {
  cx: number;
  cy: number;
  radius: number;
}

export function getGameBoundary(): CircleBoundary {
  // Circular world boundary centered at origin to match circular minimap
  const boundarySize = 6000; // Diameter of playable area (3x larger)
  const buffer = 100; // Extra buffer before ship is considered out
  const radius = boundarySize / 2 + buffer; // 3000 + 100

  return {
    cx: 0,
    cy: 0,
    radius,
  };
}
