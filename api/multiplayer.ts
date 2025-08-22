import type { BotShoot } from '../src/entities/bot/types.ts';
import type {
  ClientMessage,
  PlayerJoin,
  PlayerLeave,
  PlayerShoot,
  PlayerUpdate,
  ServerMessage,
} from '../src/multiplayer/types.ts';
import { Vector } from '../src/physics/Vector.ts';

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
  exploding: boolean;
  lastUpdate: number;
  ws: WebSocketWithEvents;
}

interface VercelRequest {
  method: string;
  socket: unknown;
  head: unknown;
}

interface VercelResponse {
  status(code: number): { json(data: unknown): void };
}

class MultiplayerServer {
  private players: Map<string, ConnectedPlayer> = new Map();
  private gameTime: number = 0;

  constructor() {
    // Start game loop for cleanup
    setInterval(() => this.gameLoop(), 1000 / 10); // 10 FPS for cleanup
  }

  private gameLoop(): void {
    this.gameTime++;

    // Clean up stale players (haven't updated in 5 seconds)
    const now = Date.now();
    for (const [id, player] of this.players.entries()) {
      if (now - player.lastUpdate > 5000) {
        this.removePlayer(id);
      }
    }
  }

  public handleConnection(
    ws: WebSocket & {
      on(event: string, listener: (...args: unknown[]) => void): void;
    }
  ): void {
    ws.on('message', (data: unknown) => {
      try {
        const message: ClientMessage = JSON.parse(String(data)) as ClientMessage;
        this.handleClientMessage(message, ws);
      } catch (error) {
        console.error('Failed to parse client message:', error);
        this.sendError(ws, 'Invalid message format');
      }
    });

    ws.on('close', () => {
      // Find and remove the player
      for (const [id, player] of this.players.entries()) {
        if (player.ws === ws) {
          this.removePlayer(id);
          break;
        }
      }
    });
  }

  private handleClientMessage(message: ClientMessage, ws: WebSocketWithEvents): void {
    switch (message.type) {
      case 'join':
        if (this.isPlayerJoinData(message.data)) {
          this.handlePlayerJoin(message.data, ws);
        }
        break;
      case 'leave':
        if (this.isPlayerLeaveData(message.data)) {
          this.handlePlayerLeave(message.data);
        }
        break;
      case 'update':
        if (this.isPlayerUpdateData(message.data)) {
          this.handlePlayerUpdate(message.data);
        }
        break;
      case 'shoot':
        if (this.isPlayerShootData(message.data)) {
          this.handlePlayerShoot(message.data);
        }
        break;
      case 'botShoot':
        if (this.isBotShootData(message.data)) {
          this.handleBotShoot(message.data);
        }
        break;
      default:
        this.sendError(ws, 'Unknown message type');
    }
  }

  private isPlayerJoinData(
    data: PlayerJoin | PlayerLeave | PlayerUpdate | PlayerShoot | BotShoot
  ): data is PlayerJoin {
    return 'name' in data && 'position' in data;
  }

  private isPlayerLeaveData(
    data: PlayerJoin | PlayerLeave | PlayerUpdate | PlayerShoot | BotShoot
  ): data is PlayerLeave {
    return 'id' in data && Object.keys(data).length === 1;
  }

  private isPlayerUpdateData(
    data: PlayerJoin | PlayerLeave | PlayerUpdate | PlayerShoot | BotShoot
  ): data is PlayerUpdate {
    return 'position' in data && 'velocity' in data && 'r' in data && 'a' in data;
  }

  private isPlayerShootData(
    data: PlayerJoin | PlayerLeave | PlayerUpdate | PlayerShoot | BotShoot
  ): data is PlayerShoot {
    return 'laserStart' in data && 'laserDirection' in data && 'id' in data;
  }

  private isBotShootData(
    data: PlayerJoin | PlayerLeave | PlayerUpdate | PlayerShoot | BotShoot
  ): data is BotShoot {
    return (
      'laserStart' in data &&
      'laserDirection' in data &&
      'botId' in data &&
      'targetPlayerId' in data
    );
  }

  private handlePlayerJoin(data: PlayerJoin, ws: WebSocketWithEvents): void {
    const player: ConnectedPlayer = {
      ...data,
      velocity: new Vector(0, 0),
      r: 0,
      a: 0,
      lives: 3,
      score: 0,
      exploding: false,
      lastUpdate: Date.now(),
      ws,
    };

    this.players.set(data.id, player);

    // Notify all other players about the new player
    this.broadcastToOthers(data.id, {
      type: 'playerJoin',
      data: {
        id: data.id,
        name: data.name,
        position: data.position,
      },
      timestamp: Date.now(),
    });

    // Send current game state to the new player
    this.sendGameState(data.id);
  }

  private handlePlayerLeave(data: PlayerLeave): void {
    this.removePlayer(data.id);
  }

  private handlePlayerUpdate(data: PlayerUpdate): void {
    const player = this.players.get(data.id);
    if (player) {
      Object.assign(player, data);
      player.lastUpdate = Date.now();

      // Broadcast update to other players
      this.broadcastToOthers(data.id, {
        type: 'playerUpdate',
        data,
        timestamp: Date.now(),
      });
    }
  }

  private handlePlayerShoot(data: PlayerShoot): void {
    // Broadcast shooting to other players
    this.broadcastToOthers(data.id, {
      type: 'playerShoot',
      data,
      timestamp: Date.now(),
    });
  }

  private handleBotShoot(data: BotShoot): void {
    // Handle bot shooting - broadcast to other players
    this.broadcastToOthers(data.targetPlayerId, {
      type: 'botShoot',
      data,
      timestamp: Date.now(),
    });
  }

  private removePlayer(id: string): void {
    const player = this.players.get(id);
    if (player) {
      // Notify other players about the departure
      this.broadcastToOthers(id, {
        type: 'playerLeave',
        data: { id },
        timestamp: Date.now(),
      });

      // Close the WebSocket connection
      try {
        player.ws.close();
      } catch (error) {
        console.error('Error closing WebSocket:', error);
      }

      this.players.delete(id);
    }
  }

  private broadcastToOthers(excludeId: string, message: ServerMessage): void {
    for (const [id, player] of this.players.entries()) {
      if (id !== excludeId) {
        try {
          player.ws.send(JSON.stringify(message));
        } catch (error) {
          console.error(`Failed to send message to player ${id}:`, error);
          // Remove player if we can't send to them
          this.removePlayer(id);
        }
      }
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
      console.error(`Failed to send game state to player ${playerId}:`, error);
    }
  }

  private sendError(ws: WebSocketWithEvents, message: string): void {
    try {
      ws.send(
        JSON.stringify({
          type: 'error',
          data: message,
          timestamp: Date.now(),
        })
      );
    } catch (error) {
      console.error('Failed to send error message:', error);
    }
  }

  public getPlayerCount(): number {
    return this.players.size;
  }
}

// Create server instance
const server = new MultiplayerServer();

// Export the WebSocket handler
export default function handler(req: VercelRequest, res: VercelResponse): void {
  if (req.method === 'GET') {
    // For now, return a message that WebSocket is ready
    // In a real Vercel deployment, this would handle WebSocket upgrade
    res.status(200).json({
      message: 'WebSocket endpoint ready',
      playerCount: server.getPlayerCount(),
      note: 'WebSocket upgrade not yet implemented for Vercel',
    });
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
