import { WebSocket, WebSocketServer } from 'ws';
import type {
  ClientMessage,
  PlayerJoin,
  PlayerLeave,
  PlayerShoot,
  PlayerUpdate,
  ServerMessage,
} from '../src/multiplayer/types.js';
import { logger } from './serverLogger.js';

// Server-compatible Vector class (no browser dependencies)
class Vector {
  constructor(
    readonly x: number,
    readonly y: number
  ) {}

  add(other: Vector): Vector {
    return new Vector(this.x + other.x, this.y + other.y);
  }

  subtract(other: Vector): Vector {
    return new Vector(this.x - other.x, this.y - other.y);
  }

  multiply(scalar: number): Vector {
    return new Vector(this.x * scalar, this.y * scalar);
  }

  magnitude(): number {
    return Math.sqrt(this.x ** 2 + this.y ** 2);
  }

  distance(other: Vector): number {
    return Math.sqrt((this.x - other.x) ** 2 + (this.y - other.y) ** 2);
  }

  normalize(): Vector {
    const mag = this.magnitude();
    if (mag === 0) {
      return new Vector(0, 0);
    }
    return new Vector(this.x / mag, this.y / mag);
  }

  limit(max: number): Vector {
    const mag = this.magnitude();
    if (mag > max) {
      return this.normalize().multiply(max);
    }
    return new Vector(this.x, this.y);
  }

  divide(scalar: number): Vector {
    if (scalar === 0) {
      return new Vector(0, 0);
    }
    return new Vector(this.x / scalar, this.y / scalar);
  }
}

type WebSocketWithEvents = WebSocket & {
  on(event: string, listener: (...args: unknown[]) => void): void;
};

interface ConnectedPlayer {
  id: string;
  name: string;
  position: Vector;
  velocity: Vector;
  r: number;
  a: number;
  lives: number;
  score: number;
  dead: boolean;
  exploding: boolean;
  lastUpdate: number;
  ws: WebSocketWithEvents;
}

class LocalMultiplayerServer {
  private players: Map<string, ConnectedPlayer> = new Map();
  private gameTime: number = 0;
  public wss: WebSocketServer;

  constructor(port: number = 3001) {
    this.wss = new WebSocketServer({ port });
    logger.info(`🚀 Local multiplayer server running on ws://localhost:${port}`);

    this.setupWebSocketServer();

    // Start game loop for cleanup
    setInterval(() => this.gameLoop(), 1000 / 10); // 10 FPS for cleanup
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocketWithEvents) => {
      logger.info('🔌 New player connected');

      ws.on('message', (data: unknown) => {
        try {
          const message = JSON.parse(String(data)) as ClientMessage;
          this.handleClientMessage(message, ws);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error('Failed to parse client message:', errorMessage);
          this.sendError(ws, 'Invalid message format');
        }
      });

      ws.on('close', () => {
        // Find and remove the player
        for (const [id, player] of this.players.entries()) {
          if (player.ws === ws) {
            logger.info(`👋 Player ${player.name} (${id}) disconnected`);
            this.removePlayer(id);
            break;
          }
        }
      });

      ws.on('error', (error) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('❌ WebSocket error:', errorMessage);
      });
    });
  }

  private gameLoop(): void {
    this.gameTime++;

    // Clean up stale players (haven't updated in 30 seconds)
    const now = Date.now();
    for (const [id, player] of this.players.entries()) {
      if (now - player.lastUpdate > 30000) {
        logger.debug(`🧹 Cleaning up stale player ${player.name} (${id})`);
        this.removePlayer(id);
      }
    }
  }

  private handleClientMessage(message: ClientMessage, ws: WebSocketWithEvents): void {
    try {
      switch (message.type) {
        case 'join':
          this.handlePlayerJoin(message.data as PlayerJoin, ws);
          break;
        case 'leave':
          this.handlePlayerLeave(message.data as PlayerLeave);
          break;
        case 'update':
          this.handlePlayerUpdate(message.data as PlayerUpdate);
          break;
        case 'shoot':
          this.handlePlayerShoot(message.data as PlayerShoot);
          break;
        default:
          this.sendError(ws, 'Unknown message type');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      logger.error('Error handling client message:', errorMessage, errorStack);
      this.sendError(ws, 'Internal server error');
    }
  }

  private handlePlayerJoin(data: PlayerJoin, ws: WebSocketWithEvents): void {
    const player: ConnectedPlayer = {
      ...data,
      velocity: new Vector(0, 0),
      r: 0,
      a: 0,
      lives: 3,
      score: 0,
      dead: false,
      exploding: false,
      lastUpdate: Date.now(),
      ws,
    };

    this.players.set(player.id, player);
    logger.info(`🎮 Player ${player.name} (${player.id}) joined the game`);

    // Send confirmation to the joining player
    const joinMessage: ServerMessage = {
      type: 'playerJoin',
      data: {
        id: player.id,
        name: player.name,
        position: player.position,
      },
      timestamp: Date.now(),
    };
    ws.send(JSON.stringify(joinMessage));

    // Send current game state to the new player
    this.sendGameState(player.id);

    // Broadcast to all other players
    this.broadcastToOthers(ws, joinMessage);
  }

  private handlePlayerLeave(data: PlayerLeave): void {
    this.removePlayer(data.id);
  }

  private handlePlayerUpdate(data: PlayerUpdate): void {
    const player = this.players.get(data.id);
    if (player) {
      // Update player data
      Object.assign(player, data);
      player.lastUpdate = Date.now();

      // Broadcast update to all other players
      const updateMessage: ServerMessage = {
        type: 'playerUpdate',
        data: {
          id: player.id,
          position: player.position,
          velocity: player.velocity,
          r: player.r,
          a: player.a,
          lives: player.lives,
          score: player.score,
          exploding: player.exploding,
        },
        timestamp: Date.now(),
      };
      this.broadcastToOthers(player.ws, updateMessage);
    }
  }

  private handlePlayerShoot(data: PlayerShoot): void {
    // Broadcast shoot event to all other players
    const shootMessage: ServerMessage = {
      type: 'playerShoot',
      data: {
        id: data.id,
        laserStart: data.laserStart,
        laserDirection: data.laserDirection,
      },
      timestamp: Date.now(),
    };

    const shooter = this.players.get(data.id);
    if (shooter) {
      this.broadcastToOthers(shooter.ws, shootMessage);
    }
  }

  private sendGameState(playerId: string): void {
    const player = this.players.get(playerId);
    if (!player) {
      return;
    }

    const gameState: ServerMessage = {
      type: 'gameState',
      data: {
        players: Array.from(this.players.values()).map((p) => ({
          id: p.id,
          name: p.name,
          position: p.position,
          velocity: p.velocity,
          r: p.r,
          a: p.a,
          lives: p.lives,
          score: p.score,
          exploding: p.exploding,
        })),
        asteroids: [], // Will be implemented in Phase 2
        gameTime: this.gameTime,
      },
      timestamp: Date.now(),
    };

    try {
      player.ws.send(JSON.stringify(gameState));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to send game state to player ${playerId}:`, errorMessage);
    }
  }

  private removePlayer(id: string): void {
    const player = this.players.get(id);
    if (player) {
      // Close the WebSocket connection
      try {
        player.ws.close();
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Error closing WebSocket:', errorMessage);
      }

      // Remove from players map
      this.players.delete(id);

      // Broadcast leave message to remaining players
      const leaveMessage: ServerMessage = {
        type: 'playerLeave',
        data: { id },
        timestamp: Date.now(),
      };
      this.broadcastToAll(leaveMessage);

      logger.info(`👋 Player ${player.name} (${id}) removed. Total players: ${this.players.size}`);
    }
  }

  private broadcastToAll(message: ServerMessage): void {
    const messageStr = JSON.stringify(message);
    for (const player of this.players.values()) {
      try {
        if (player.ws.readyState === WebSocket.OPEN) {
          player.ws.send(messageStr);
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Error broadcasting message:', errorMessage);
      }
    }
  }

  private broadcastToOthers(excludeWs: WebSocket, message: ServerMessage): void {
    const messageStr = JSON.stringify(message);
    for (const player of this.players.values()) {
      if (player.ws !== excludeWs && player.ws.readyState === WebSocket.OPEN) {
        try {
          player.ws.send(messageStr);
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error('Error broadcasting message:', errorMessage);
        }
      }
    }
  }

  private sendError(ws: WebSocket, message: string): void {
    try {
      ws.send(JSON.stringify({ type: 'error', message }));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Error sending error message:', errorMessage);
    }
  }

  public getStats(): void {
    logger.info(`📊 Server Stats - Players: ${this.players.size}, Game Time: ${this.gameTime}`);
  }
}

// Start the server
const server = new LocalMultiplayerServer(3001);

// Log stats every 10 seconds
setInterval(() => server.getStats(), 10000);

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('\n🛑 Shutting down multiplayer server...');
  server.wss.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('\n🛑 Shutting down multiplayer server...');
  server.wss.close();
  process.exit(0);
});
