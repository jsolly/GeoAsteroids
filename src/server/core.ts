import { WebSocket } from 'ws';
import { logger } from '../../setup/serverLogger';

// Player management
export interface ConnectedPlayer {
  id: string;
  name: string;
  ws: WebSocket;
  lastUpdate: number;
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  rotation: number;
  health: number;
  score: number;
}

// Message types
export interface ClientMessage {
  type: string;
  data?: Record<string, unknown>;
  id?: string;
  name?: string;
  [key: string]: unknown;
}

export interface ServerMessage {
  type: string;
  data?: unknown;
  timestamp: number;
  [key: string]: unknown;
}

export class WebSocketCore {
  private players = new Map<string, ConnectedPlayer>();
  private gameTime = 0;

  constructor() {
    // Start game loop for cleanup (10 FPS)
    setInterval(() => {
      this.gameTime++;
      this.cleanupStalePlayers();
    }, 100);
  }

  private cleanupStalePlayers(): void {
    // Clean up stale players (haven't updated in 30 seconds)
    const now = Date.now();
    for (const [id, player] of this.players.entries()) {
      if (now - player.lastUpdate > 30000) {
        logger.debug(`🧹 Cleaning up stale player ${player.name} (${id})`);
        this.removePlayer(id);
      }
    }
  }

  public addPlayer(id: string, name: string, ws: WebSocket): void {
    this.players.set(id, {
      id,
      name,
      ws,
      lastUpdate: Date.now(),
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      rotation: 0,
      health: 100,
      score: 0,
    });
    logger.info(`👤 Player ${name} (${id}) added`);
  }

  public removePlayer(id: string): void {
    const player = this.players.get(id);
    if (player) {
      logger.info(`👋 Player ${player.name} (${id}) removed`);
      this.players.delete(id);
    }
  }

  public updatePlayer(id: string, data: Partial<ConnectedPlayer>): void {
    const player = this.players.get(id);
    if (player) {
      Object.assign(player, data);
      player.lastUpdate = Date.now();
    }
  }

  public getPlayerCount(): number {
    return this.players.size;
  }

  public getPlayer(id: string): ConnectedPlayer | undefined {
    return this.players.get(id);
  }

  public getAllPlayers(): ConnectedPlayer[] {
    return Array.from(this.players.values());
  }

  public broadcastToAll(message: ServerMessage, excludeId?: string): void {
    const messageStr = JSON.stringify(message);
    for (const [id, player] of this.players.entries()) {
      if (id !== excludeId && player.ws.readyState === WebSocket.OPEN) {
        player.ws.send(messageStr);
      }
    }
  }

  public sendToWebSocket(ws: WebSocket, message: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  public sendError(ws: WebSocket, message: string): void {
    this.sendToWebSocket(ws, { type: 'error', data: message, timestamp: Date.now() });
  }

  public handleClientMessage(message: ClientMessage, ws: WebSocket): void {
    // Accept both top-level fields and nested data payloads for compatibility
    const type = message.type;
    const payload = typeof message.data === 'object' && message.data !== null ? message.data : {};
    const id = message.id ?? payload.id;
    const name = message.name ?? payload.name;
    const restData = { ...payload, ...message } as Record<string, unknown>;
    delete restData.type;
    delete restData.data;
    delete restData.id;
    delete restData.name;

    switch (type) {
      case 'join':
        if (!id || !name) {
          this.sendError(ws, 'Missing player ID or name');
          return;
        }
        this.addPlayer(id as string, name as string, ws);
        this.sendToWebSocket(ws, { type: 'joined', id, name, timestamp: Date.now() });
        this.broadcastToAll(
          {
            type: 'playerJoin',
            data: { id, name, position: { x: 0, y: 0 } },
            timestamp: Date.now(),
          },
          id as string
        );
        this.broadcastGameState();
        break;

      case 'update':
        if (!id) {
          this.sendError(ws, 'Missing player ID');
          return;
        }
        this.updatePlayer(id as string, restData);
        this.broadcastToAll(
          { type: 'playerUpdate', data: { id, ...restData }, timestamp: Date.now() },
          id as string
        );
        break;

      case 'chat': {
        if (!id || !restData.message) {
          this.sendError(ws, 'Missing player ID or message');
          return;
        }
        const player = this.getPlayer(id as string);
        if (player) {
          this.broadcastToAll({
            type: 'chat',
            data: {
              id,
              name: player.name,
              message: restData.message,
            },
            timestamp: Date.now(),
          });
        }
        break;
      }

      case 'ping':
        this.sendToWebSocket(ws, { type: 'pong', timestamp: Date.now() });
        break;

      default:
        logger.warn(`Unknown message type: ${type}`);
        this.sendError(ws, `Unknown message type: ${type}`);
    }
  }

  public broadcastGameState(): void {
    const gameState = {
      type: 'gameState',
      data: {
        players: Array.from(this.players.values()).map(
          ({ id, name, position, velocity, rotation, health, score }) => ({
            id,
            name,
            position,
            velocity: velocity || { x: 0, y: 0 },
            radius: 15, // Default ship radius
            angle: rotation || 0, // Use rotation as angle for backward compatibility
            lives: health || 3,
            score,
            exploding: false, // default to false
          })
        ),
        asteroids: [], // Empty array for now, can be populated later
        gameTime: this.gameTime,
      },
      timestamp: Date.now(),
    };
    this.broadcastToAll(gameState);
  }

  public startPeriodicGameStateBroadcast(): void {
    // Periodic game state broadcast (5 FPS)
    setInterval(() => {
      if (this.players.size > 0) {
        this.broadcastGameState();
      }
    }, 200);
  }
}
