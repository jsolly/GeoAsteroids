import { MultiplayerManager } from '../../multiplayer/multiplayerManager';
import { BotManager } from '../bot/botManager';
import type { Player } from './Player';

class PlayerManager {
  private static instance: PlayerManager;
  private multiplayerManager: MultiplayerManager;
  private botManager: BotManager;

  private constructor() {
    this.multiplayerManager = MultiplayerManager.getInstance();
    this.botManager = BotManager.getInstance();
  }

  public static getInstance(): PlayerManager {
    if (!PlayerManager.instance) {
      PlayerManager.instance = new PlayerManager();
    }
    return PlayerManager.instance;
  }

  public getNonLocalPlayers(): Player[] {
    const remotes = Array.from(this.multiplayerManager.getRemotePlayers().values());
    const bots = Array.from(this.botManager.getBots().values());
    return [...remotes, ...bots];
  }

  public getAllPlayersIncludingLocal(local: Player): Player[] {
    return [local, ...this.getNonLocalPlayers()];
  }

  public getBotPlayers(): Player[] {
    return Array.from(this.botManager.getBots().values());
  }

  public getRemotePlayers(): Player[] {
    return Array.from(this.multiplayerManager.getRemotePlayers().values());
  }

  public getPlayerById(id: string): Player | undefined {
    // Search remotes first
    const remote = this.multiplayerManager.getRemotePlayers().get(id);
    if (remote) {
      return remote;
    }
    // Then bots
    return this.botManager.getBots().get(id);
  }

  public getCounts(): { total: number; remoteHumans: number; bots: number } {
    const remoteHumans = this.multiplayerManager.getRemotePlayerCount();
    const bots = this.botManager.getBots().size;
    return { total: remoteHumans + bots, remoteHumans, bots };
  }
}

export { PlayerManager };
