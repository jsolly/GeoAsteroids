/** Both map readouts round first so small negative values display +0 consistently. */
export function formatMapCoordinate(value: number): string {
  const rounded = Math.round(value);
  return `${rounded >= 0 ? '+' : ''}${rounded}`;
}
