import { WebSocket } from 'ws';
import { logger } from '../setup/serverLogger';
import type { Position, Velocity } from '../shared-types';

// Player management
export interface ConnectedPlayer {
  id: string;
  name: string;
  position: Position;
  velocity: Velocity;
  rotation: number;
  angularVelocity: number;
  lives: number;
  score: number;
  exploding: boolean;
  lastUpdate: number;
  ws: WebSocket;
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

  public addPlayer(id: string, name: string, ws: WebSocket, position?: Position): void {
    const player: ConnectedPlayer = {
      id,
      name,
      position: position || { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      rotation: 0,
      angularVelocity: 0,
      lives: 3,
      score: 0,
      exploding: false,
      lastUpdate: Date.now(),
      ws,
    };

    this.players.set(id, player);
    logger.info(`👤 Player ${name} (${id}) added`);
  }

  public removePlayer(id: string): void {
    const player = this.players.get(id);
    if (player) {
      logger.info(`👋 Player ${player.name} (${id}) removed`);
      this.players.delete(id);
    }
  }

  public updatePlayer(id: string, data: any): void {
    const player = this.players.get(id);
    if (player) {
      // Use Object.assign for efficient bulk assignment
      const updates: Partial<ConnectedPlayer> = {};
      
      if (data.position) updates.position = data.position;
      if (data.velocity) updates.velocity = data.velocity;
      if (data.rotation !== undefined) updates.rotation = data.rotation;
      if (data.angularVelocity !== undefined) updates.angularVelocity = data.angularVelocity;
      if (data.lives !== undefined) updates.lives = data.lives;
      if (data.score !== undefined) updates.score = data.score;
      if (data.exploding !== undefined) updates.exploding = data.exploding;
      
      // Backward compatibility for old a property (r is ship radius, not player rotation)
      if (data.a !== undefined) updates.angularVelocity = data.a;
      
      Object.assign(player, updates);
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

  public broadcastToAll(message: any, excludeId?: string): void {
    const messageStr = JSON.stringify(message);
    for (const [id, player] of this.players.entries()) {
      if (id !== excludeId && player.ws.readyState === WebSocket.OPEN) {
        player.ws.send(messageStr);
      }
    }
  }

  public sendToWebSocket(ws: WebSocket, message: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  public sendError(ws: WebSocket, message: string): void {
    this.sendToWebSocket(ws, { type: 'error', data: message, timestamp: Date.now() });
  }

  public handleClientMessage(message: any, ws: WebSocket): void {
    // Accept both top-level fields and nested data payloads for compatibility
    const type = message.type;
    const payload = typeof message.data === 'object' && message.data !== null ? message.data : {};
    const id = message.id ?? payload.id;
    const name = message.name ?? payload.name;
    const restData = { ...payload, ...message };
    delete (restData as any).type;
    delete (restData as any).data;
    delete (restData as any).id;
    delete (restData as any).name;

    switch (type) {
      case 'join':
        if (!id || !name) {
          this.sendError(ws, 'Missing player ID or name');
          return;
        }
        
        // Handle position if provided by client
        let joinPosition = { x: 0, y: 0 };
        if (restData.position && typeof restData.position === 'object') {
          joinPosition = restData.position;
        }
        
        this.addPlayer(id as string, name as string, ws, joinPosition);

        // Send confirmation to the joining player
        this.sendToWebSocket(ws, {
          type: 'joined',
          id,
          name,
          position: joinPosition,
        });

        // Broadcast to all other players
        this.broadcastToAll(
          {
            type: 'playerJoined',
            id,
            name,
            position: joinPosition,
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
        // Direct assignment - no conversion needed since we use plain objects
        
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
                  ({ id, name, position, velocity, rotation, angularVelocity, lives, score, exploding }) => ({
          id,
          name,
          position,
          velocity: velocity || { x: 0, y: 0 },
          rotation: rotation || 0,
          angularVelocity: angularVelocity || 0, // angular velocity, default to 0
          lives: lives || 3,
          score,
          exploding: exploding || false,
        })
        ),
        roids: [], // Empty array for now, can be populated later
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
