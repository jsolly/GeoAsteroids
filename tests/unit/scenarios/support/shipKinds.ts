/** Local, remote, and bot ships share `Ship`. Scenario tests run each through the same cases. */
export const SHIP_KINDS = [
  { kind: 'player ship', options: { isLocalPlayer: true } },
  { kind: 'remote ship', options: {} },
  { kind: 'bot ship', options: { isBot: true } },
] as const;
