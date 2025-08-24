export function isBot(player: { type: 'local' | 'remote' | 'bot' }): boolean {
  return player.type === 'bot';
}

export function isRemote(player: { type: 'local' | 'remote' | 'bot' }): boolean {
  return player.type === 'remote';
}

export function isLocal(player: { type: 'local' | 'remote' | 'bot' }): boolean {
  return player.type === 'local';
}
