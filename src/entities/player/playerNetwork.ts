import { GameController } from '../../core/gameController';
import { MultiplayerManager } from '../../multiplayer/multiplayerManager';
import type { Player, Position } from './types';

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
    // Always update local player state for bots, regardless of connection status
    // This ensures bots can target the player even when not connected to multiplayer
    this.gameController.updateMultiplayerPlayerState();

    // Update all players' ship states
    const players = this.multiplayerManager.players;
    for (const player of players.values()) {
      // Update ship explosion state
      player.ship.updateExplosion();

      // Update ship invincibility system
      player.ship.updateInvincibility();

      // Update ship health regeneration system
      player.ship.updateHealth();
    }

    // Only update network state if connected
    if (this.multiplayerManager.isConnected) {
      // Update player count in game state
      const playerCount = this.multiplayerManager.players.size;
      this.gameController.getGameState().setPlayerCount(playerCount);
    }
  }

  // Remote players should not be force-respawned client-side; server/state updates handle respawn.

  public getOtherPlayers(): Player[] {
    const players = this.multiplayerManager.players;
    return Array.from(players.values());
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
    const players = this.multiplayerManager.players;
    return players.get(id);
  }

  public getLocalPlayerInfo(): { id: string; name: string } {
    return {
      id: this.multiplayerManager.localPlayerId,
      name: this.multiplayerManager.localPlayerName,
    };
  }

  public getConnectionStatus(): { connected: boolean; playerCount: number } {
    return {
      connected: this.multiplayerManager.isConnected,
      playerCount: this.multiplayerManager.players.size,
    };
  }
}
