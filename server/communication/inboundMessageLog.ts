const HIGH_FREQUENCY_INBOUND = new Set(['update', 'ping', 'pong']);

/**
 * High-frequency gameplay frames (60 Hz updates, 0.5 Hz pings) must not
 * hit stdout or the log file. Pretty-printing every inbound payload was
 * stalling the Railway event loop and starving broadcasts — both tabs
 * then hit the 6s heartbeat and showed "Disconnected from game server."
 */
export function shouldLogInboundGameplayMessage(type: unknown): boolean {
  return typeof type === 'string' && type.length > 0 && !HIGH_FREQUENCY_INBOUND.has(type);
}
