import type { Position } from '../../../shared-types';
import { GameController } from '../../core/gameController';
import { MultiplayerManager } from '../../multiplayer/multiplayerManager';
import type { Player } from './Player';

export class PlayerNetwork {
  private static instance: PlayerNetwork;
  private multiplayerManager: MultiplayerManager;
  private gameController: GameController;
  private updateInterval: ReturnType<typeof setInterval> | null = null;
  private readonly UPDATE_FREQUENCY = 60; // 60 FPS

  private constructor() {
    this.multiplayerManager = MultiplayerManager.getInstance();
    this.gameController = GameController.getInstance();
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
    const botPlayers = allPlayers.filter((player) => player.type === 'bot');
    if (botPlayers.length > 0) {
      const roids = this.gameController.getCurrRoidBelt()?.getRoids() || [];
      const otherPlayers = allPlayers.filter((player) => player.type !== 'bot');
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
    const otherPlayers = this.getOtherPlayers();
    return [localPlayer, ...otherPlayers];
  }

  public getOtherPlayers(): Player[] {
    // Return all non-local players (remote and bot/bots)
    const remotePlayers = Array.from(this.multiplayerManager.players.values());
    const botPlayers = Array.from(this.multiplayerManager.getBots().values());
    return [...remotePlayers, ...botPlayers];
  }

  public getPlayersByType(type: 'local' | 'remote' | 'bot'): Player[] {
    return this.getAllPlayers().filter((player) => player.type === type);
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
    // Search all players (remote and bot/bots)
    return this.getAllPlayers().find((player) => player.id === id);
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
    const allPlayers = this.getAllPlayers();
    return {
      connected: this.multiplayerManager.isConnected,
      playerCount: allPlayers.length,
      remoteHumanCount: this.getPlayersByType('remote').length,
      botCount: this.getPlayersByType('bot').length,
    };
  }
}
