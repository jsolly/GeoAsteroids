import { IPlayer } from './types/multiplayer.js';
import { MultiplayerManager } from './multiplayerManager.js';
import { GameController } from './gameController.js';
import { Vector } from './vector.js';

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

    // Only update network state if connected
    if (this.multiplayerManager.isPlayerConnected()) {
      // Update player count in game state
      const playerCount = this.multiplayerManager.getPlayerCount();
      this.gameController.getGameState().setPlayerCount(playerCount);
    }
  }

  public getOtherPlayers(): IPlayer[] {
    const players = this.multiplayerManager.getPlayers();
    return Array.from(players.values());
  }

  public isPlayerNearby(
    player: IPlayer,
    localPlayer: { position: Vector },
    viewportRadius: number = 1200,
  ): boolean {
    if (!localPlayer || !localPlayer.position) {
      return false;
    }

    const distance = Math.sqrt(
      Math.pow(player.position.x - localPlayer.position.x, 2) +
        Math.pow(player.position.y - localPlayer.position.y, 2),
    );

    return distance <= viewportRadius;
  }

  public getVisiblePlayers(
    localPlayer: { position: Vector },
    viewportRadius: number = 1200,
  ): IPlayer[] {
    return this.getOtherPlayers().filter((player) =>
      this.isPlayerNearby(player, localPlayer, viewportRadius),
    );
  }

  public getPlayerById(id: string): IPlayer | undefined {
    const players = this.multiplayerManager.getPlayers();
    return players.get(id);
  }

  public getLocalPlayerInfo(): { id: string; name: string } {
    return {
      id: this.multiplayerManager.getLocalPlayerId(),
      name: this.multiplayerManager.getLocalPlayerName(),
    };
  }

  public getConnectionStatus(): { connected: boolean; playerCount: number } {
    return {
      connected: this.multiplayerManager.isPlayerConnected(),
      playerCount: this.multiplayerManager.getPlayerCount(),
    };
  }
}
