import { v4 as uuidv4 } from 'uuid';
import type { BotPlayer, BotShoot } from '../entities/bot/types';
import type { Player } from '../entities/player/types';
import { Ship } from '../entities/ship/Ship';
import { Vector } from '../physics/Vector';
import { BotIntegrationManager } from './botIntegrationManager';
import type {
  ClientMessage,
  GameState,
  PlayerJoin,
  PlayerLeave,
  PlayerUpdate,
  ServerMessage,
} from './types';

export class MultiplayerManager {
  private static instance: MultiplayerManager;
  private socket: WebSocket | null = null;
  public players: Map<string, Player> = new Map();
  public localPlayerId: string;
  public localPlayerName: string;
  public isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;
  private botIntegration: BotIntegrationManager;

  private constructor() {
    this.localPlayerId = uuidv4();
    this.localPlayerName = `Player_${Math.floor(Math.random() * 1000)}`;
    this.botIntegration = new BotIntegrationManager();
  }

  public static getInstance(): MultiplayerManager {
    if (!MultiplayerManager.instance) {
      MultiplayerManager.instance = new MultiplayerManager();
    }
    return MultiplayerManager.instance;
  }

  public connect(): void {
    if (this.isConnected || this.socket) {
      console.info('MULTIPLAYER', 'Already connected or connecting');
      return;
    }

    // If WebSocket is disabled, create test players immediately
    if (import.meta.env.VITE_WEBSOCKET_ENABLED === 'false') {
      console.info('MULTIPLAYER', 'WebSocket disabled, creating test players immediately');
      this.createTestPlayers();
      return;
    }

    try {
      const wsUrl = import.meta.env.VITE_WEBSOCKET_URL || 'ws://localhost:3001';
      console.info('MULTIPLAYER', 'Connecting to multiplayer server', { wsUrl });

      this.socket = new WebSocket(wsUrl);
      this.setupWebSocketHandlers();

      // Test players are disabled by default
      // Only create test players if explicitly enabled for testing
      if (import.meta.env.VITE_ENABLE_TEST_PLAYERS === 'true') {
        setTimeout(() => {
          if (!this.isConnected) {
            this.createTestPlayers();
          }
        }, 2000);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('MULTIPLAYER', 'Failed to connect to multiplayer server', {
        error: errorMessage,
      });
      this.handleConnectionError();
    }
  }

  private setupWebSocketHandlers(): void {
    if (!this.socket) {
      return;
    }

    this.socket.onopen = (): void => {
      console.info('MULTIPLAYER', 'Connected to multiplayer server');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.joinGame();
    };

    this.socket.onmessage = (event: MessageEvent): void => {
      try {
        if (typeof event.data === 'string') {
          const parsedData: unknown = JSON.parse(event.data);
          if (parsedData && typeof parsedData === 'object') {
            const message: ServerMessage = parsedData as ServerMessage;
            this.handleServerMessage(message);
          }
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('MULTIPLAYER', 'Failed to parse server message', {
          error: errorMessage,
        });
      }
    };

    this.socket.onclose = (): void => {
      console.info('MULTIPLAYER', 'Disconnected from multiplayer server');
      this.isConnected = false;
      this.handleDisconnection();
    };

    this.socket.onerror = (error: Event): void => {
      console.error('MULTIPLAYER', 'WebSocket error', { error: error.type });
      this.handleConnectionError();
    };
  }

  private handleServerMessage(message: ServerMessage): void {
    switch (message.type) {
      case 'playerJoin':
        this.handlePlayerJoin(message.data as PlayerJoin);
        break;
      case 'playerLeave':
        this.handlePlayerLeave(message.data as PlayerLeave);
        break;
      case 'playerUpdate':
        this.handlePlayerUpdate(message.data as PlayerUpdate);
        break;
      case 'playerShoot':
        this.handlePlayerShoot();
        break;
      case 'botShoot':
        this.handleBotShoot(message.data as BotShoot);
        break;
      case 'gameState':
        this.handleGameState(message.data as GameState);
        break;
      case 'error':
        if (typeof message.data === 'string') {
          console.error('Server error:', message.data);
        }
        break;
    }
  }

  private handlePlayerJoin(data: PlayerJoin): void {
    if (data.id !== this.localPlayerId) {
      const ship = new Ship();
      ship.position = data.position;

      const newPlayer: Player = {
        id: data.id,
        name: data.name,
        ship,
        score: 0,
        lastUpdate: Date.now(),
        lives: 3, // Default lives for new players
        spawnProtectedUntil: Date.now() + 3000, // 3 seconds spawn protection
        respawn: () => {},
        onShipExploded: () => {},
      };
      this.players.set(data.id, newPlayer);
      // console.log(`Player ${data.name} joined the game`);
    }
  }

  private handlePlayerLeave(data: PlayerLeave): void {
    const player = this.players.get(data.id);
    if (player) {
      // console.log(`Player ${player.name} left the game`);
      this.players.delete(data.id);
    }
  }

  private handlePlayerUpdate(data: PlayerUpdate): void {
    if (data.id !== this.localPlayerId) {
      const player = this.players.get(data.id);
      if (player) {
        if (data.position) {
          player.ship.position = data.position;
        }
        if (data.velocity) {
          player.ship.velocity = data.velocity;
        }
        if (data.r !== undefined) {
          player.ship.r = data.r;
        }
        if (data.a !== undefined) {
          player.ship.a = data.a;
        }
        if (data.lives !== undefined) {
          player.lives = data.lives;
        }
        if (data.score !== undefined) {
          player.score = data.score;
        }

        if (data.exploding !== undefined) {
          player.ship.exploding = data.exploding;
        }
        player.lastUpdate = Date.now();
      }
    }
  }

  private handlePlayerShoot(): void {
    // Handle other players shooting - will be implemented in Phase 2
    // console.log('Player shot a laser');
  }

  private handleGameState(data: GameState): void {
    // Clear existing players (except local player) and add all players from game state
    for (const [id] of this.players.entries()) {
      if (id !== this.localPlayerId) {
        this.players.delete(id);
      }
    }

    // Add all players from the game state (except local player)
    for (const playerData of data.players) {
      if (playerData.id !== this.localPlayerId) {
        const ship = new Ship();
        ship.position = playerData.position;
        ship.velocity = playerData.velocity;
        ship.r = playerData.r;
        ship.a = playerData.a;
        ship.exploding = playerData.exploding;

        const newPlayer: Player = {
          id: playerData.id,
          name: playerData.name,
          ship,
          score: playerData.score,
          lastUpdate: Date.now(),
          lives: playerData.lives || 3, // Get lives from playerData or default to 3
          spawnProtectedUntil: Date.now() + 3000, // 3 seconds spawn protection
          respawn: () => {},
          onShipExploded: () => {},
        };
        this.players.set(playerData.id, newPlayer);
      }
    }
  }

  private joinGame(): void {
    const joinMessage: ClientMessage = {
      type: 'join',
      data: {
        id: this.localPlayerId,
        name: this.localPlayerName,
        position: new Vector(0, 0), // Use world origin instead of canvas center
      },
      timestamp: Date.now(),
    };
    this.sendMessage(joinMessage);
  }

  public updatePlayerState(update: Partial<PlayerUpdate>): void {
    if (!this.isConnected || !this.socket) {
      return;
    }

    const updateMessage: ClientMessage = {
      type: 'update',
      data: {
        id: this.localPlayerId,
        position: update.position || new Vector(0, 0),
        velocity: update.velocity || new Vector(0, 0),
        r: update.r || 0,
        a: update.a || 0,
        lives: update.lives || 3,
        score: update.score || 0,
        exploding: update.exploding || false,
      },
      timestamp: Date.now(),
    };
    this.sendMessage(updateMessage);
  }

  public shootLaser(laserStart: Vector, laserDirection: Vector): void {
    if (!this.isConnected || !this.socket) {
      return;
    }

    const shootMessage: ClientMessage = {
      type: 'shoot',
      data: {
        id: this.localPlayerId,
        laserStart,
        laserDirection,
      },
      timestamp: Date.now(),
    };
    this.sendMessage(shootMessage);
  }

  private sendMessage(message: ClientMessage): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  private handleConnectionError(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => this.connect(), this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  private handleDisconnection(): void {
    this.players.clear();
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      setTimeout(() => this.connect(), this.reconnectDelay);
    }
  }

  public disconnect(): void {
    if (this.socket) {
      const leaveMessage: ClientMessage = {
        type: 'leave',
        data: { id: this.localPlayerId },
        timestamp: Date.now(),
      };
      this.sendMessage(leaveMessage);
      this.socket.close();
      this.socket = null;
    }
    this.isConnected = false;
    this.players.clear();
  }

  public removePlayer(playerId: string): void {
    const player = this.players.get(playerId);
    if (player) {
      console.info('🗑️ PLAYER_REMOVED', 'Removing player from game', {
        playerId,
        playerName: player.name,
        reason: 'No lives remaining',
      });

      this.players.delete(playerId);

      // Dispatch event to notify other systems
      window.dispatchEvent(
        new CustomEvent('playerRemoved', {
          detail: {
            playerId,
            playerName: player.name,
            reason: 'No lives remaining',
          },
        })
      );
    }
  }

  public enableBots(count: number = 3): void {
    console.info('MULTIPLAYER', 'Enabling bots', { count });
    this.botIntegration.enableBots(count);
  }

  public disableBots(): void {
    this.botIntegration.disableBots();
    console.info('MULTIPLAYER', 'Bots disabled and projectiles cleared');
  }

  public getBots(): Map<string, BotPlayer> {
    return this.botIntegration.manager.getBots();
  }

  // Legacy bot bullet accessors are removed in favor of lasers

  public updateBotsInGameLoop(): void {
    this.botIntegration.manager.updateBotsInGameLoop();
  }

  public debugDestroyBot(botId: string): void {
    this.botIntegration.manager.empDestroyBot(botId);
  }

  public empDestroyBot(botId: string): void {
    this.botIntegration.manager.empDestroyBot(botId);
  }

  public updateLocalPlayerForBots(position: Vector, alive: boolean): void {
    this.botIntegration.updateLocalPlayerForBots(position, alive);
  }

  private handleBotShoot(botShoot: BotShoot): void {
    // Handle bot shooting - this will be processed by the game controller
    console.info('MULTIPLAYER', 'Bot shot detected', {
      botId: botShoot.botId,
      targetPlayerId: botShoot.targetPlayerId,
      laserStart: botShoot.laserStart,
      laserDirection: botShoot.laserDirection,
    });

    // Emit a custom event that the game controller can listen to
    window.dispatchEvent(
      new CustomEvent('botShoot', {
        detail: botShoot,
      })
    );
  }

  // Debug method to show current state
  public debugState(): void {
    console.info('MULTIPLAYER', 'Multiplayer Debug State', {
      connected: this.isConnected,
      localPlayerId: this.localPlayerId,
      localPlayerName: this.localPlayerName,
      totalPlayers: this.players.size,
      players: Array.from(this.players.values()).map((p) => ({
        id: p.id,
        name: p.name,
        position: p.ship.position,
      })),
    });
  }

  // Expose multiplayer testing commands to browser console
  public static exposeToWindow(): void {
    if (typeof window !== 'undefined') {
      const multiplayer = {
        connect: (): void => MultiplayerManager.getInstance().connect(),
        disconnect: (): void => MultiplayerManager.getInstance().disconnect(),
        enableBots: (count?: number): void =>
          void MultiplayerManager.getInstance().enableBots(count),
        disableBots: (): void => MultiplayerManager.getInstance().disableBots(),
        getBots: (): Map<string, BotPlayer> => MultiplayerManager.getInstance().getBots(),
        // getBotBullets removed in favor of lasers
        getPlayers: (): Map<string, Player> => MultiplayerManager.getInstance().players,
        getLocalPlayerId: (): string => MultiplayerManager.getInstance().localPlayerId,
        getLocalPlayerName: (): string => MultiplayerManager.getInstance().localPlayerName,
        getPlayerCount: (): number => MultiplayerManager.getInstance().players.size,
        createTestPlayers: (): void => MultiplayerManager.getInstance().createTestPlayers(),
        debugDestroyBot: (botId: string): void =>
          MultiplayerManager.getInstance().debugDestroyBot(botId),
      };

      (window as { multiplayer?: typeof multiplayer }).multiplayer = multiplayer;
    }
  }

  // Make the local ship invincible for testing
  public makeInvincible(): void {
    console.info('MULTIPLAYER', 'Making ship invincible for testing');

    // Get the game controller and make the ship invincible
    const gameController = (
      window as {
        gameController?: {
          getCurrShip: () => {
            lives: number;
            dead: boolean;
            exploding: boolean;
            explodeTime: number;
          };
        };
      }
    ).gameController;
    if (gameController?.getCurrShip) {
      const ship = gameController.getCurrShip();
      if (ship) {
        ship.lives = 999; // Set to very high number
        ship.dead = false;
        ship.exploding = false;
        ship.explodeTime = 0;
        console.info('MULTIPLAYER', 'Ship is now invincible', {
          lives: ship.lives,
        });
      }
    } else {
      console.warn('MULTIPLAYER', 'Could not access game controller. Try refreshing the page.');
    }
  }

  private createTestPlayers(): void {
    // Test players are disabled by default
    // Only create if explicitly enabled for testing
    if (import.meta.env.VITE_ENABLE_TEST_PLAYERS !== 'true') {
      console.info('MULTIPLAYER', 'Test players disabled by default');
      return;
    }

    console.info('MULTIPLAYER', 'Creating test players for local testing', {
      reason: 'WebSocket connection failed or testing mode',
    });

    // Test player configurations
    const testPlayerConfigs = [
      {
        id: 'test-player-1',
        name: 'TestPlayer1',
        position: new Vector(200, 200),
        rotation: Math.PI / 4,
        score: 1500,
      },
      {
        id: 'test-player-2',
        name: 'TestPlayer2',
        position: new Vector(-200, -200),
        rotation: -Math.PI / 3,
        score: 2300,
      },
      {
        id: 'test-player-3',
        name: 'TestPlayer3',
        position: new Vector(300, -150),
        rotation: Math.PI / 2,
        score: 1800,
      },
      {
        id: 'test-player-4',
        name: 'TestPlayer4',
        position: new Vector(-150, 300),
        rotation: -Math.PI / 6,
        score: 2100,
      },
    ];

    for (const config of testPlayerConfigs) {
      const ship = new Ship(3, true, {
        position: config.position,
        rotation: config.rotation,
      });

      const testPlayer: Player = {
        id: config.id,
        name: config.name,
        ship,
        score: config.score,
        lastUpdate: Date.now(),
        isBot: false,
        lives: 3,
        spawnProtectedUntil: Date.now() + 3000, // 3 seconds spawn protection
        respawn: () => {},
        onShipExploded: () => {},
      };

      this.players.set(testPlayer.id, testPlayer);
    }

    console.info('MULTIPLAYER', 'Test players created successfully', {
      count: testPlayerConfigs.length,
      playerIds: testPlayerConfigs.map((c) => c.id),
    });
  }
}
