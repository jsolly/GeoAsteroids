export function generateRandomPlayerColor(): string {
  const colors = [
    '#FF6B6B', // Red
    '#4ECDC4', // Teal
    '#45B7D1', // Blue
    '#96CEB4', // Green
    '#FFEAA7', // Yellow
    '#DDA0DD', // Plum
    '#98D8C8', // Mint
    '#F7DC6F', // Gold
    '#BB8FCE', // Lavender
    '#85C1E9', // Sky Blue
    '#F8C471', // Orange
    '#82E0AA', // Light Green
    '#F1948A', // Light Red
    '#85C1E9', // Light Blue
    '#FAD7A0', // Peach
  ];

  return colors[Math.floor(Math.random() * colors.length)];
}
