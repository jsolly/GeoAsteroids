import { v4 as uuidv4 } from 'uuid';
import {
  IPlayer,
  IPlayerUpdate,
  IPlayerJoin,
  IPlayerLeave,
  IServerMessage,
  IClientMessage,
  IBotPlayer,
  IBotShoot,
  IBotBullet,
  IGameState,
} from './types/multiplayer.js';
import { WEBSOCKET_ENABLED } from './constants.js';
import { Vector } from './vector.js';
import { BotManager } from './botManager.js';

export class MultiplayerManager {
  private static instance: MultiplayerManager;
  private socket: WebSocket | null = null;
  private players: Map<string, IPlayer> = new Map();
  private localPlayerId: string;
  private localPlayerName: string;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;
  private botManager: BotManager;

  private constructor() {
    this.localPlayerId = uuidv4();
    this.localPlayerName = `Player_${Math.floor(Math.random() * 1000)}`;
    this.botManager = BotManager.getInstance();

    // Set up bot shooting callback
    this.botManager.setBotShootCallback((botShoot: IBotShoot) => {
      this.handleBotShoot(botShoot);
    });
  }

  public static getInstance(): MultiplayerManager {
    if (!MultiplayerManager.instance) {
      MultiplayerManager.instance = new MultiplayerManager();
    }
    return MultiplayerManager.instance;
  }

  public connect(): void {
    try {
      // Check if WebSocket connections are enabled
      if (!WEBSOCKET_ENABLED) {
        console.info(
          'MULTIPLAYER',
          'WebSocket connections disabled by environment variable VITE_WEBSOCKET_ENABLED=false',
        );
        return;
      }

      // Use WebSocket for Vercel deployment, fallback to Socket.io for local development
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host =
        window.location.hostname === 'localhost'
          ? 'localhost:3001'
          : 'geoasteroids-production.up.railway.app';
      const wsUrl = `${protocol}//${host}/ws`;

      this.socket = new WebSocket(wsUrl);
      this.setupWebSocketHandlers();

      // Mock players are disabled by default
      // Only create mock players if explicitly enabled for testing
      if (import.meta.env.VITE_ENABLE_MOCK_PLAYERS === 'true') {
        setTimeout(() => {
          if (!this.isConnected) {
            this.createMockPlayers();
          }
        }, 2000);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error('MULTIPLAYER', 'Failed to connect to multiplayer server', {
        error: errorMessage,
      });
      this.handleConnectionError();
    }
  }

  private setupWebSocketHandlers(): void {
    if (!this.socket) return;

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
            const message: IServerMessage = parsedData as IServerMessage;
            this.handleServerMessage(message);
          }
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
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

  private handleServerMessage(message: IServerMessage): void {
    switch (message.type) {
      case 'playerJoin':
        this.handlePlayerJoin(message.data as IPlayerJoin);
        break;
      case 'playerLeave':
        this.handlePlayerLeave(message.data as IPlayerLeave);
        break;
      case 'playerUpdate':
        this.handlePlayerUpdate(message.data as IPlayerUpdate);
        break;
      case 'playerShoot':
        this.handlePlayerShoot();
        break;
      case 'botShoot':
        this.handleBotShoot(message.data as IBotShoot);
        break;
      case 'gameState':
        this.handleGameState(message.data as IGameState);
        break;
      case 'error':
        if (typeof message.data === 'string') {
          console.error('Server error:', message.data);
        }
        break;
    }
  }

  private handlePlayerJoin(data: IPlayerJoin): void {
    if (data.id !== this.localPlayerId) {
      const newPlayer: IPlayer = {
        id: data.id,
        name: data.name,
        position: data.position,
        velocity: new Vector(0, 0),
        r: 0,
        a: 0,
        lives: 3,
        score: 0,
        dead: false,
        exploding: false,
        lastUpdate: Date.now(),
      };
      this.players.set(data.id, newPlayer);
      // console.log(`Player ${data.name} joined the game`);
    }
  }

  private handlePlayerLeave(data: IPlayerLeave): void {
    const player = this.players.get(data.id);
    if (player) {
      // console.log(`Player ${player.name} left the game`);
      this.players.delete(data.id);
    }
  }

  private handlePlayerUpdate(data: IPlayerUpdate): void {
    if (data.id !== this.localPlayerId) {
      const player = this.players.get(data.id);
      if (player) {
        if (data.position) player.position = data.position;
        if (data.velocity) player.velocity = data.velocity;
        if (data.r !== undefined) player.r = data.r;
        if (data.a !== undefined) player.a = data.a;
        if (data.lives !== undefined) player.lives = data.lives;
        if (data.score !== undefined) player.score = data.score;
        if (data.dead !== undefined) player.dead = data.dead;
        if (data.exploding !== undefined) player.exploding = data.exploding;
        player.lastUpdate = Date.now();
      }
    }
  }

  private handlePlayerShoot(): void {
    // Handle other players shooting - will be implemented in Phase 2
    // console.log('Player shot a laser');
  }

  private handleGameState(data: IGameState): void {
    // Handle full game state updates
    console.log(
      'Received game state update with',
      data.players.length,
      'players',
    );

    // Clear existing players (except local player) and add all players from game state
    for (const [id] of this.players.entries()) {
      if (id !== this.localPlayerId) {
        this.players.delete(id);
      }
    }

    // Add all players from the game state (except local player)
    for (const playerData of data.players) {
      if (playerData.id !== this.localPlayerId) {
        const newPlayer: IPlayer = {
          id: playerData.id,
          name: playerData.name,
          position: playerData.position,
          velocity: playerData.velocity,
          r: playerData.r,
          a: playerData.a,
          lives: playerData.lives,
          score: playerData.score,
          dead: playerData.dead,
          exploding: playerData.exploding,
          lastUpdate: Date.now(),
        };
        this.players.set(playerData.id, newPlayer);
        console.log(
          `Added existing player ${playerData.name} (${playerData.id}) from game state`,
        );
      }
    }
  }

  private joinGame(): void {
    const joinMessage: IClientMessage = {
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

  public updatePlayerState(update: Partial<IPlayerUpdate>): void {
    if (!this.isConnected || !this.socket) return;

    const updateMessage: IClientMessage = {
      type: 'update',
      data: {
        id: this.localPlayerId,
        position: update.position || new Vector(0, 0),
        velocity: update.velocity || new Vector(0, 0),
        r: update.r || 0,
        a: update.a || 0,
        lives: update.lives || 3,
        score: update.score || 0,
        dead: update.dead || false,
        exploding: update.exploding || false,
      },
      timestamp: Date.now(),
    };
    this.sendMessage(updateMessage);
  }

  public shootLaser(laserStart: Vector, laserDirection: Vector): void {
    if (!this.isConnected || !this.socket) return;

    const shootMessage: IClientMessage = {
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

  private sendMessage(message: IClientMessage): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  private handleConnectionError(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(
        `Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`,
      );
      setTimeout(
        () => this.connect(),
        this.reconnectDelay * this.reconnectAttempts,
      );
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
      const leaveMessage: IClientMessage = {
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

  public getPlayers(): Map<string, IPlayer> {
    return this.players;
  }

  public getLocalPlayerId(): string {
    return this.localPlayerId;
  }

  public getLocalPlayerName(): string {
    return this.localPlayerName;
  }

  public isPlayerConnected(): boolean {
    return this.isConnected;
  }

  public getPlayerCount(): number {
    return this.players.size + 1; // +1 for local player
  }

  public enableBots(count: number = 3): void {
    console.info('MULTIPLAYER', 'Enabling bots', { count });
    this.botManager.activate();
    this.botManager.createBots(count);
  }

  public disableBots(): void {
    this.botManager.deactivate();
    this.botManager.clearBotBullets(); // Clear any active bot bullets
    console.info('MULTIPLAYER', 'Bots disabled and bullets cleared');
  }

  public getBots(): Map<string, IBotPlayer> {
    return this.botManager.getBots();
  }

  public getBotBullets(): Map<string, IBotBullet> {
    return this.botManager.getBotBullets();
  }

  public updateBotBullets(): void {
    this.botManager.updateBotBullets();
  }

  public updateBotsInGameLoop(): void {
    this.botManager.updateBotsInGameLoop();
  }

  public debugDestroyBot(botId: string): void {
    this.botManager.debugDestroyBot(botId);
  }

  public empDestroyBot(botId: string): void {
    this.botManager.empDestroyBot(botId);
  }

  public updateLocalPlayerForBots(position: Vector, alive: boolean): void {
    this.botManager.updateLocalPlayerPosition(position, alive);
  }

  private handleBotShoot(botShoot: IBotShoot): void {
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
      }),
    );
  }

  // Public method to create mock players for testing (even when connected)
  public createTestPlayers(): void {
    // Mock players are disabled by default
    // Only create if explicitly enabled for testing
    if (import.meta.env.VITE_ENABLE_MOCK_PLAYERS !== 'true') {
      console.info('MULTIPLAYER', 'Mock players disabled by default');
      return;
    }

    console.info(
      'MULTIPLAYER',
      'Creating test players for demonstration purposes',
    );

    // Clear any existing mock players first
    for (const [id] of this.players.entries()) {
      if (id.startsWith('mock-')) {
        this.players.delete(id);
      }
    }

    // Create new mock players
    this.createMockPlayers();

    // Force a state update to ensure players are visible
    setTimeout(() => {
      console.info('MULTIPLAYER', 'Current players after creation', {
        players: Array.from(this.players.values()).map((p) => ({
          id: p.id,
          name: p.name,
        })),
      });
    }, 100);
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
        position: p.position,
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
        getBots: (): Map<string, IBotPlayer> =>
          MultiplayerManager.getInstance().getBots(),
        getBotBullets: (): Map<string, IBotBullet> =>
          MultiplayerManager.getInstance().getBotBullets(),
        getPlayers: (): Map<string, IPlayer> =>
          MultiplayerManager.getInstance().getPlayers(),
        getLocalPlayerId: (): string =>
          MultiplayerManager.getInstance().getLocalPlayerId(),
        getLocalPlayerName: (): string =>
          MultiplayerManager.getInstance().getLocalPlayerName(),
        getPlayerCount: (): number =>
          MultiplayerManager.getInstance().getPlayerCount(),
        createTestPlayers: (): void =>
          MultiplayerManager.getInstance().createTestPlayers(),
        debugDestroyBot: (botId: string): void =>
          MultiplayerManager.getInstance().debugDestroyBot(botId),
      };

      (window as { multiplayer?: typeof multiplayer }).multiplayer =
        multiplayer;

      console.log('🚀 Multiplayer commands exposed to window.multiplayer:');
      console.log('multiplayer.connect() - Connect to multiplayer server');
      console.log(
        'multiplayer.disconnect() - Disconnect from multiplayer server',
      );
      console.log('multiplayer.enableBots(count) - Enable bots (default: 3)');
      console.log('multiplayer.disableBots() - Disable all bots');
      console.log('multiplayer.getBots() - Get all bots');
      console.log('multiplayer.getBotBullets() - Get all bot bullets');
      console.log('multiplayer.getPlayers() - Get all players');
      console.log('multiplayer.getLocalPlayerId() - Get local player ID');
      console.log('multiplayer.getLocalPlayerName() - Get local player name');
      console.log('multiplayer.getPlayerCount() - Get player count');
      console.log(
        'multiplayer.createTestPlayers() - Create mock players for testing',
      );
      console.log(
        'multiplayer.debugDestroyBot(botId) - Manually destroy a bot for testing',
      );
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
    if (gameController && gameController.getCurrShip) {
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
      console.warn(
        'MULTIPLAYER',
        'Could not access game controller. Try refreshing the page.',
      );
    }
  }

  private createMockPlayers(): void {
    // Mock players are disabled by default
    // Only create if explicitly enabled for testing
    if (import.meta.env.VITE_ENABLE_MOCK_PLAYERS !== 'true') {
      console.info('MULTIPLAYER', 'Mock players disabled by default');
      return;
    }

    console.info('MULTIPLAYER', 'Creating mock players for local testing', {
      reason: 'WebSocket connection failed or testing mode',
    });

    // Create 2 mock players with independent starting positions in world coordinates
    const mockPlayer1: IPlayer = {
      id: 'mock-player-1',
      name: 'TestPlayer1',
      position: new Vector(200, 200), // World coordinates around origin
      velocity: new Vector(0, 0),
      r: 15,
      a: Math.PI / 4, // 45 degrees
      lives: 3,
      score: 1500,
      dead: false,
      exploding: false,
      lastUpdate: Date.now(),
    };

    const mockPlayer2: IPlayer = {
      id: 'mock-player-2',
      name: 'TestPlayer2',
      position: new Vector(-200, -200), // World coordinates around origin
      velocity: new Vector(0, 0),
      r: 15,
      a: -Math.PI / 3, // -60 degrees
      lives: 3,
      score: 2300,
      dead: false,
      exploding: false,
      lastUpdate: Date.now(),
    };

    this.players.set(mockPlayer1.id, mockPlayer1);
    this.players.set(mockPlayer2.id, mockPlayer2);

    console.info('MULTIPLAYER', 'Mock players created successfully', {
      player1: { name: mockPlayer1.name, position: mockPlayer1.position },
      player2: { name: mockPlayer2.name, position: mockPlayer2.position },
    });

    // Mark mock players as stable and persistent
    this.markMockPlayersAsStable();

    // Wait a bit before starting movement to avoid initial flashing
    setTimeout(() => {
      this.startMockPlayerMovement();
      console.info('MULTIPLAYER', 'Mock players are now moving');
    }, 1000);
  }

  private markMockPlayersAsStable(): void {
    // Ensure mock players are always considered "recent" for rendering
    // and don't get cleaned up by connection changes
    setInterval(() => {
      for (const [id, player] of this.players.entries()) {
        if (id.startsWith('mock-')) {
          player.lastUpdate = Date.now();
          // Ensure mock players are never marked as stale
          player.dead = false;
          player.exploding = false;
        }
      }
    }, 500); // Update timestamp every 500ms
  }

  private startMockPlayerMovement(): void {
    // Store movement state for each player
    const movementState = new Map<
      string,
      {
        direction: number;
        lastDirectionChange: number;
        targetX: number;
        targetY: number;
      }
    >();

    // Initialize movement state
    for (const [id, player] of this.players.entries()) {
      if (id.startsWith('mock-')) {
        movementState.set(id, {
          direction: Math.random() * Math.PI * 2,
          lastDirectionChange: Date.now(),
          targetX: player.position.x,
          targetY: player.position.y,
        });
      }
    }

    setInterval(() => {
      for (const [id, player] of this.players.entries()) {
        if (id.startsWith('mock-')) {
          const state = movementState.get(id);
          if (!state) continue;

          const now = Date.now();

          // Change direction occasionally (every 3-8 seconds)
          if (now - state.lastDirectionChange > 3000 + Math.random() * 5000) {
            state.direction = Math.random() * Math.PI * 2;
            state.lastDirectionChange = now;

            // Set new target position
            const distance = 100 + Math.random() * 150;
            state.targetX =
              player.position.x + Math.cos(state.direction) * distance;
            state.targetY =
              player.position.y + Math.sin(state.direction) * distance;

            // Allow free movement in world coordinates (no canvas bounds)
          }

          // Move towards target
          const dx = state.targetX - player.position.x;
          const dy = state.targetY - player.position.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance > 5) {
            // Move towards target
            const speed = 0.8;
            const moveX = (dx / distance) * speed;
            const moveY = (dy / distance) * speed;

            player.position = new Vector(
              player.position.x + moveX,
              player.position.y + moveY,
            );

            // Update ship rotation to face movement direction
            player.a = Math.atan2(moveY, moveX);
          }

          player.lastUpdate = Date.now();
        }
      }
    }, 100); // Update every 100ms for smoother movement
  }
}
