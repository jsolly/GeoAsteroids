/** Human-readable killer for HUD / game-over copy. */
export function describeDeathCause(
  attackerId: string | undefined,
  resolveName?: (id: string) => string | undefined
): string {
  if (!attackerId) {
    return 'unknown';
  }
  if (attackerId === 'asteroid') {
    return 'an asteroid';
  }
  if (attackerId === 'boundary') {
    return 'the arena wall';
  }
  return resolveName?.(attackerId) ?? attackerId;
}

/** Overlay string. Omit "killed by unknown" when the cause is missing. */
export function formatGameOverText(deathCause?: string): string {
  if (!deathCause || deathCause === 'unknown') {
    return 'Game Over';
  }
  return `Game Over: You were killed by ${deathCause}`;
}

/**
 * A fresh local player (3 lives, full health) can see a leftover 0-life
 * server snapshot for the previous session. That is not a real death.
 */
export function isStaleGameOverSnapshot(params: {
  prevLives: number;
  nextLives: number;
  deathCause?: string;
  health?: number;
  exploding?: boolean;
}): boolean {
  const drop = params.prevLives - params.nextLives;
  if (drop <= 1 || params.nextLives > 0) {
    return false;
  }
  if (params.deathCause || params.exploding) {
    return false;
  }
  if (params.health !== undefined && params.health <= 0) {
    return false;
  }
  return true;
}
