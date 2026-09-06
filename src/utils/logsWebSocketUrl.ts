/**
 * Derive the client-log WebSocket from the gameplay URL so production
 * talks to Railway `/logs` instead of `www.georoids.com:3001/logs`.
 */
export function logsWebSocketUrlFromGameplay(
  gameplayUrl: string | undefined,
  pageHost: string,
  isSecure: boolean
): string {
  if (typeof gameplayUrl === 'string' && gameplayUrl.length > 0) {
    if (/\/ws\/?$/.test(gameplayUrl)) {
      return gameplayUrl.replace(/\/ws\/?$/, '/logs');
    }
    const trimmed = gameplayUrl.replace(/\/$/, '');
    return `${trimmed}/logs`;
  }
  const protocol = isSecure ? 'wss' : 'ws';
  return `${protocol}://${pageHost}/logs`;
}
