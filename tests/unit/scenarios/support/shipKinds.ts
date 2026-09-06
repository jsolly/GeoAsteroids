/** Player and bot ships share `Ship`. Scenario tests run both through the same cases. */
export const SHIP_KINDS = [
  { kind: 'player ship', options: { isLocalPlayer: true } },
  { kind: 'bot ship', options: { isBot: true } },
] as const;
