import type { Position } from '../../../shared-types';
import { GameController } from '../../core/gameController';
import { NetworkManager } from '../../network/networkManager';
import type { Player } from './Player';
import { PlayerManager } from './PlayerManager';

export class PlayerNetwork {
  private static instance: PlayerNetwork;
  private networkManager: NetworkManager;
  private gameController: GameController;
  private playerManager: PlayerManager;
  private updateInterval: ReturnType<typeof setInterval> | null = null;
  private readonly UPDATE_FREQUENCY = 60; // 60 FPS

  private constructor() {
    this.networkManager = NetworkManager.getInstance();
    this.playerManager = PlayerManager.getInstance();
    // Eagerly initialize gameController to prevent race conditions
    this.gameController = GameController.getInstance();
  }

  private getGameController(): GameController {
    return this.gameController;
  }

  public static getInstance(): PlayerNetwork {
    if (!PlayerNetwork.instance) {
      PlayerNetwork.instance = new PlayerNetwork();
    }
    return PlayerNetwork.instance;
  }

  public startNetworkUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    this.updateInterval = setInterval(() => {
      this.updatePlayerState();
    }, 1000 / this.UPDATE_FREQUENCY);
  }

  public stopNetworkUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  public updatePlayerState(): void {
    // Update local player state for network (network-only)
    this.getGameController().updateNetworkPlayerState();

    // Bot data updates are handled by the network manager's bot sync manager
  }

  // Remote players should not be force-respawned client-side; server/state updates handle respawn.

  public getAllPlayers(): Player[] {
    // Get ALL players: local, remote, and bots
    const localPlayer = this.getGameController().getCurrPlayer();
    if (localPlayer) {
      return this.playerManager.getAllPlayersIncludingLocal(localPlayer);
    }
    return this.playerManager.getNonLocalPlayers();
  }

  public getOtherPlayers(): Player[] {
    // Return all non-local players via unified manager
    return this.playerManager.getNonLocalPlayers();
  }

  public getPlayersByType(type: 'local' | 'remote' | 'bot'): Player[] {
    // Unified method to get players by type
    const allPlayers = this.getAllPlayers();
    return allPlayers.filter((player) => player.type === type);
  }

  public getRemotePlayers(): Player[] {
    return this.getPlayersByType('remote');
  }

  public getBotPlayers(): Player[] {
    return this.getPlayersByType('bot');
  }

  public isPlayerNearby(
    player: Player,
    localPlayer: { position: Position },
    viewportRadius: number = 1200
  ): boolean {
    if (!localPlayer || !localPlayer.position) {
      return false;
    }

    const distance = Math.sqrt(
      (player.ship.position.x - localPlayer.position.x) ** 2 +
        (player.ship.position.y - localPlayer.position.y) ** 2
    );

    return distance <= viewportRadius;
  }

  public getVisiblePlayers(
    localPlayer: { position: Position },
    viewportRadius: number = 1200
  ): Player[] {
    return this.getOtherPlayers().filter((player) =>
      this.isPlayerNearby(player, localPlayer, viewportRadius)
    );
  }

  public getPlayerById(id: string): Player | undefined {
    // Check if it's the local player first
    const localPlayer = this.getGameController().getCurrPlayer();
    if (localPlayer && localPlayer.id === id) {
      return localPlayer;
    }

    // Otherwise search non-local players via PlayerManager
    return this.playerManager.getPlayerById(id);
  }

  public getLocalPlayerInfo(): { id: string; name: string } {
    return {
      id: this.networkManager.getLocalPlayerId(),
      name: this.networkManager.getLocalPlayerName(),
    };
  }

  public getConnectionStatus(): {
    connected: boolean;
    playerCount: number;
    remoteHumanCount: number;
    botCount: number;
  } {
    const counts = this.playerManager.getCounts();
    return {
      connected: this.networkManager.isConnected,
      playerCount: counts.total + 1, // include local
      remoteHumanCount: counts.remoteHumans,
      botCount: counts.bots,
    };
  }
}
