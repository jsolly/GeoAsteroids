import type { Position } from '../../../shared-types';
import { GameController } from '../../core/gameController';
import { MultiplayerManager } from '../../multiplayer/multiplayerManager';
import type { Player } from './Player';
import { PlayerManager } from './PlayerManager';

export class PlayerNetwork {
  private static instance: PlayerNetwork;
  private multiplayerManager: MultiplayerManager;
  private gameController: GameController;
  private playerManager: PlayerManager;
  private updateInterval: ReturnType<typeof setInterval> | null = null;
  private readonly UPDATE_FREQUENCY = 60; // 60 FPS

  private constructor() {
    this.multiplayerManager = MultiplayerManager.getInstance();
    this.gameController = GameController.getInstance();
    this.playerManager = PlayerManager.getInstance();
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
    // Update local player state for multiplayer (network-only)
    this.gameController.updateMultiplayerPlayerState();

    // Get all players (remote and bot)
    const allPlayers = this.getAllPlayers();

    // Update AI data for bots (bot players need roids and other players for decision making)
    const botPlayers = this.getBotPlayers();
    if (botPlayers.length > 0) {
      const roids = this.gameController.getCurrRoidBelt()?.getRoids() || [];
      const otherPlayers = this.getRemotePlayers(); // Bots need to know about remote players
      this.multiplayerManager.updateAllPlayerData(roids, otherPlayers);
    }

    // Only update network-derived counts if connected
    if (this.multiplayerManager.isConnected) {
      this.gameController.getGameState().playerCount = allPlayers.length;
    }
  }

  // Remote players should not be force-respawned client-side; server/state updates handle respawn.

  public getAllPlayers(): Player[] {
    // Get ALL players: local, remote, and bots
    const localPlayer = this.gameController.getCurrPlayer();
    return this.playerManager.getAllPlayersIncludingLocal(localPlayer);
  }

  public getOtherPlayers(): Player[] {
    // Return all non-local players via unified manager
    return this.playerManager.getNonLocalPlayers();
  }

  public getBotPlayers(): Player[] {
    return this.playerManager.getBotPlayers();
  }

  public getRemotePlayers(): Player[] {
    return this.playerManager.getRemotePlayers();
  }

  public getPlayersByType(type: 'local' | 'remote' | 'bot'): Player[] {
    switch (type) {
      case 'local':
        return [this.gameController.getCurrPlayer()];
      case 'remote':
        return this.getRemotePlayers();
      case 'bot':
        return this.getBotPlayers();
      default:
        return [];
    }
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
    const localPlayer = this.gameController.getCurrPlayer();
    if (localPlayer.id === id) {
      return localPlayer;
    }

    // Otherwise search non-local players via PlayerManager
    return this.playerManager.getPlayerById(id);
  }

  public getLocalPlayerInfo(): { id: string; name: string } {
    return {
      id: this.multiplayerManager.localPlayerId,
      name: this.multiplayerManager.localPlayerName,
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
      connected: this.multiplayerManager.isConnected,
      playerCount: counts.total + 1, // include local
      remoteHumanCount: counts.remoteHumans,
      botCount: counts.bots,
    };
  }
}
