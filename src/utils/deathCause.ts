/** Tokens that must never be printed on the HUD / game-over overlay. */
export function isGenericDeathCause(cause?: string): boolean {
  return !cause || cause === 'unknown' || cause === 'server-damage';
}

/**
 * First specific killer wins. Generic tokens (unknown / server-damage) lose
 * to a later wall / asteroid / name so a lagged snapshot cannot lock GO.
 */
export function preferDeathCause(...causes: Array<string | undefined>): string | undefined {
  for (const cause of causes) {
    if (cause && !isGenericDeathCause(cause)) {
      return cause;
    }
  }
  return causes.find((cause) => Boolean(cause));
}

function looksLikeEntityId(id: string): boolean {
  return (
    id.startsWith('server-bot-') ||
    id.startsWith('client-') ||
    id.startsWith('server-') ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
  );
}

/** Human-readable killer for HUD / game-over copy. Never returns a raw id. */
export function describeDeathCause(
  attackerId: string | undefined,
  resolveName?: (id: string) => string | undefined
): string {
  if (isGenericDeathCause(attackerId)) {
    return 'unknown';
  }
  if (attackerId === 'asteroid') {
    return 'an asteroid';
  }
  if (attackerId === 'boundary') {
    return 'the arena wall';
  }
  if (attackerId === 'laser') {
    return 'a laser';
  }
  if (attackerId === 'player') {
    return 'another ship';
  }
  const named = resolveName?.(attackerId);
  if (named) {
    return named;
  }
  if (attackerId.startsWith('server-bot-')) {
    return 'a bot';
  }
  if (looksLikeEntityId(attackerId)) {
    return 'another ship';
  }
  return attackerId;
}

/** Overlay phrase. Undefined means omit "killed by …" (never print unknown). */
export function formatDeathCauseForOverlay(
  cause?: string,
  resolveName?: (id: string) => string | undefined
): string | undefined {
  const described = describeDeathCause(cause, resolveName);
  if (described === 'unknown') {
    return undefined;
  }
  return described;
}

/** Overlay string. Omit "killed by unknown" when the cause is missing. */
export function formatGameOverText(
  deathCause?: string,
  resolveName?: (id: string) => string | undefined
): string {
  const killer = formatDeathCauseForOverlay(deathCause, resolveName);
  if (!killer) {
    return 'Game Over';
  }
  return `Game Over: You were killed by ${killer}`;
}

/**
 * A fresh local player (3 lives, full health) can see a leftover 0-life
 * server snapshot for the previous session. That is not a real death.
 * Leftover deathCause on a full-health hull is still stale.
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
  const looksDead = params.exploding || (params.health !== undefined && params.health <= 0);
  return !looksDead;
}
