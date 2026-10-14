export type ClientLogContext = {
  sessionId: string;
  playerId?: string;
  connectionId?: string;
};

const sessionId = crypto.randomUUID();
let identity: Omit<ClientLogContext, 'sessionId'> = {};

/** Replace the current connection identity; the page session always remains stable. */
export function setClientLogContext(context: { playerId?: string; connectionId?: string }): void {
  identity = {
    ...(context.playerId != null && context.playerId !== '' ? { playerId: context.playerId } : {}),
    ...(context.connectionId != null && context.connectionId !== ''
      ? { connectionId: context.connectionId }
      : {}),
  };
}

export function getClientLogContext(): ClientLogContext {
  return { sessionId, ...identity };
}
